#!/usr/bin/env node
/**
 * Lumo-Ollama Bridge
 * 
 * This script launches the Lumo API and exposes it as an OpenAI-compatible endpoint.
 * This allows Ollama and other OpenAI-compatible tools to use Lumo as a backend.
 * 
 * Usage:
 *   node lumo-ollama.js
 *   node lumo-ollama.js ghost:true  # Enable ghost mode
 * 
 * The bridge exposes:
 *   - POST /v1/chat/completions  (OpenAI-compatible chat completions)
 *   - GET  /v1/models           (List available models)
 *   - GET  /health              (Health check)
 * 
 * Lumo API runs on: http://localhost:3333
 * OpenAI-compatible endpoint runs on: http://localhost:3334
 */

const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const LUMO_PORT = 3333;
const BRIDGE_PORT = 3334;
const LUMO_URL = `http://localhost:${LUMO_PORT}`;

let lumoProcess = null;
let lumoReady = false;

function startLumo() {
  return new Promise((resolve, reject) => {
    console.log('🚀 Starting Lumo API...');
    
    const lumoPath = path.join(__dirname, 'lumo.js');
    const args = process.argv.slice(2);
    lumoProcess = spawn('node', [lumoPath, ...args], {
      stdio: 'pipe'
    });

    let output = '';
    
    lumoProcess.stdout.on('data', (data) => {
      output += data.toString();
      process.stdout.write(data);
      
      if (output.includes('Lumo API V2 running') || output.includes('✅ Lumo UI ready')) {
        lumoReady = true;
        resolve();
      }
    });

    lumoProcess.stderr.on('data', (data) => {
      process.stderr.write(data);
    });

    lumoProcess.on('error', (err) => {
      reject(new Error(`Failed to start Lumo: ${err.message}`));
    });

    lumoProcess.on('exit', (code) => {
      if (code !== 0 && !lumoReady) {
        reject(new Error(`Lumo process exited with code ${code}`));
      }
    });

    setTimeout(() => {
      if (!lumoReady) {
        reject(new Error('Timeout waiting for Lumo to start'));
      }
    }, 60000);
  });
}

async function queryLumo(prompt, webSearch = false) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({
      prompt,
      webSearch,
      log: false,
      debug: false
    });

    const options = {
      hostname: 'localhost',
      port: LUMO_PORT,
      path: '/',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        if (res.statusCode === 200) {
          resolve(data);
        } else {
          reject(new Error(`Lumo API error: ${res.statusCode} - ${data}`));
        }
      });
    });

    req.on('error', (err) => {
      reject(new Error(`Failed to connect to Lumo: ${err.message}`));
    });

    req.write(postData);
    req.end();
  });
}

function createChatCompletion(model, content, stream = false) {
  const timestamp = Math.floor(Date.now() / 1000);
  const id = `chatcmpl-${Date.now()}`;
  
  if (stream) {
    return {
      id,
      object: 'chat.completion.chunk',
      created: timestamp,
      model,
      choices: [{
        index: 0,
        delta: { content },
        finish_reason: 'stop'
      }]
    };
  }
  
  return {
    id,
    object: 'chat.completion',
    created: timestamp,
    model,
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content
      },
      finish_reason: 'stop'
    }],
    usage: {
      prompt_tokens: -1,
      completion_tokens: -1,
      total_tokens: -1
    }
  };
}

function createBridgeServer() {
  const server = http.createServer(async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    
    if (req.method === 'OPTIONS') {
      res.writeHead(200);
      res.end();
      return;
    }

    try {
      if (req.url === '/health' && req.method === 'GET') {
        try {
          await queryLumo('hi', false);
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'healthy',
            lumo: 'connected',
            timestamp: new Date().toISOString()
          }));
        } catch (err) {
          res.writeHead(503, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({
            status: 'unhealthy',
            lumo: 'disconnected',
            error: err.message
          }));
        }
        return;
      }

      if (req.url === '/v1/models' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          object: 'list',
          data: [{
            id: 'lumo',
            object: 'model',
            created: Math.floor(Date.now() / 1000),
            owned_by: 'proton'
          }]
        }));
        return;
      }

      if (req.url === '/v1/chat/completions' && req.method === 'POST') {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', async () => {
          try {
            const data = JSON.parse(body);
            const messages = data.messages || [];
            const model = data.model || 'lumo';
            const stream = data.stream || false;
            const webSearch = data.web_search || data.webSearch || false;
            
            const lastMessage = messages[messages.length - 1];
            if (!lastMessage || !lastMessage.content) {
              res.writeHead(400, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify({ error: 'No prompt provided' }));
              return;
            }
            
            const prompt = typeof lastMessage.content === 'string' 
              ? lastMessage.content 
              : JSON.stringify(lastMessage.content);
            
            console.log(`📝 Prompt: ${prompt.substring(0, 100)}${prompt.length > 100 ? '...' : ''}`);
            
            // Query Lumo
            const response = await queryLumo(prompt, webSearch);
            
            // Create OpenAI-compatible response
            const completion = createChatCompletion(model, response, stream);
            
            if (stream) {
              res.writeHead(200, { 
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
              });
              res.write(`data: ${JSON.stringify(completion)}\n\n`);
              res.write('data: [DONE]\n\n');
              res.end();
            } else {
              res.writeHead(200, { 'Content-Type': 'application/json' });
              res.end(JSON.stringify(completion));
            }
            
            console.log('✅ Response sent');
          } catch (err) {
            console.error('❌ Error:', err.message);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ 
              error: {
                message: err.message,
                type: 'api_error'
              }
            }));
          }
        });
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
      
    } catch (err) {
      console.error('❌ Server error:', err.message);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: err.message }));
    }
  });

  return server;
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════╗');
  console.log('║           Lumo-Ollama Bridge v1.0                      ║');
  console.log('╠════════════════════════════════════════════════════════╣');
  console.log('║  OpenAI-compatible endpoint for Lumo API               ║');
  console.log('╚════════════════════════════════════════════════════════╝');
  console.log();

  try {
    await startLumo();
    console.log('✅ Lumo API is ready');
    console.log();

    const bridge = createBridgeServer();
    bridge.listen(BRIDGE_PORT, () => {
      console.log('🌉 Bridge server running');
      console.log();
      console.log('Endpoints:');
      console.log(`  • OpenAI API:  http://localhost:${BRIDGE_PORT}/v1/chat/completions`);
      console.log(`  • Models:      http://localhost:${BRIDGE_PORT}/v1/models`);
      console.log(`  • Health:      http://localhost:${BRIDGE_PORT}/health`);
      console.log();
      console.log('Usage with Ollama:');
      console.log(`  ollama run lumo --api http://localhost:${BRIDGE_PORT}/v1`);
      console.log();
      console.log('Or configure Ollama to use this endpoint as a custom model.');
      console.log();
      console.log('Press Ctrl+C to stop both servers.');
      console.log();
    });

    process.on('SIGINT', () => {
      console.log('\n\n👋 Shutting down...');
      if (lumoProcess) {
        lumoProcess.kill();
      }
      bridge.close(() => {
        process.exit(0);
      });
    });

    process.on('SIGTERM', () => {
      if (lumoProcess) {
        lumoProcess.kill();
      }
      bridge.close(() => {
        process.exit(0);
      });
    });

  } catch (err) {
    console.error('❌ Failed to start:', err.message);
    if (lumoProcess) {
      lumoProcess.kill();
    }
    process.exit(1);
  }
}

main();
