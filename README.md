#  Lumo API V2 

<img src="https://pmecdn.protonweb.com/image-transformation/?s=s&image=Lumo_OG_b782facdaf.png" width="300" height="150" />

## Introduction
I`m proud to announce the public release of **Lumo API V2**.

If you are reading this for the first time you may want to check the [V1](https://github.com/carlostkd/Lumo-Api)

This new API brings headless installations and no open Browser/tabs.

Whats new ? API V1 vs API V2


##  Features Comparison


| Feature | AIP V1 | API V2 |
|---------|-------|-------|
| File Upload | ✅ yes | ❌  No |
| Websearch   | ✅ Yes | ✅ Yes |
| Ghost Mode    | ✅ Yes | ✅ Yes but session only |
| Logs   | ✅ Basic | ✅ Advanced |
| Debug logs    | ❌  No | ✅ Yes Full Detailed |
| Upgradable in future    | ✅ Yes | ❌  Most likely No Text based only |

**Installation**

```
git clone https://github.com/carlostkd/Lumo-Api-V2.git
```

```
cd Lumo-Api-V2
```


```bash
npm install playwright
```

follow the instructions carefully but it should install everything without problems

(Ubuntu/Mint Distro Tested ✅)

After the installation lets continue

⚠️ **IMPORTANT – DO NOT IGNORE THIS STEP** ⚠️  
This instruction is critical for the security of your account! 

🚨 **WARNING:** Make sure you are in an environment you fully control before running the next step. Skipping this step may compromise security.

Run the file generate_auth.js

```bash
node generate_auth.js
```

This file opens the Browser with  the Lumo webpage

Make login wait the page is fulyl loaded after the login

Return to terminal you will see

Opening Lumo…

👉 Log in manually in the browser window.

👉 Once you see Lumo chat UI, come back here.

👉 Press ENTER in this terminal to save session.

Just do it press enter

The Browser closes and you are ready

The file auth.json was created that file contains cookies session of your login keep it safe!!

Run the App

```bash
node lumo.js
```

If you prefer the Ghost mode run:

```bash
node lumo.js ghost:true
```

The app shows you a indicator which mode are running


```
💬 Normal mode (ghost disabled)
✅ Lumo UI ready
🐈 Lumo API V2 running on http://localhost:3333
🌐 Web search disabled

```


To disable the Ghost mode you need to Restart the app and start in normal mode


Then go to another terminal tab or split it and use:

### Commands

```


curl http://localhost:3333 \
  -X POST \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"What is the weather in Zurich?"}'
	
```
	
	
```
To give you the current weather in Zurich I need up‑to‑date information. Could you turn the Web Search toggle on? Once it’s enabled I can look up the latest conditions for you.  

```


```
curl http://localhost:3333 \
  -X POST \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"What is the weather in Zurich?", "webSearch":true}'
```





```

Carlos, here's the latest weather for Zurich, Switzerland:
Temperature: 2.7 °C
Feels Like: 0.1 °C
Condition: Overcast clouds (100 % cloud cover)
Humidity: 93 %
Wind: 2.6 m/s from 130° (south‑southeast)
Pressure: 1018 hPa
That’s the straight‑up snapshot—no fluff. Let me know if you need anything else. 
```


When you want to disable the webSearch in any other command no matters which send the command to disable

For example:

```
curl http://localhost:3333 \
  -X POST \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"sum of 2+2", "webSearch":false}'
	
```


```
The sum of 2 + 2 is 4.
```


Lets see if it was disabled:

```
curl http://localhost:3333 \
  -X POST \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"What is the weather in Zurich?"}' 
```


```
I don’t have live weather data built in. To give you the current conditions in Zurich, please enable the Web Search toggle so I can look up the latest forecast. Let me know once it’s on!
```

🙂 Worked


But the app also updates you with the status of the webSearch

💬 Normal mode (ghost disabled)

✅ Lumo UI ready

🐈 Lumo API V2 running on http://localhost:3333

🌐 Web search disabled


💬 Normal mode (ghost disabled)

✅ Lumo UI ready

🐈 Lumo API V2 running on http://localhost:3333

🌐 Web search enabled


Want to save conversation logs? No worries:

```
curl http://localhost:3333 \
  -X POST \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"What is the weather in Zurich?", "websearch": true, "log":true}'
```

```
cat lumo_logs.json
```


```
{"timestamp":"2026-01-12T21:36:35.193Z","prompt":"What is the weather in Zurich?","webSearch":true,"ghost":false,"response":"Current weather in Zurich, CH\nTemperature: 2.7 °C (feels like 0.1 °C)\nCondition: Overcast clouds (100 % cloud cover)\nHumidity: 93 %\nWind: 2.6 m/s from 130° (south‑southeast)\nPressure: 1018 hPa\nThat’s the straight‑up snapshot. Let me know if you need anything else."}
```



For developers or anyone who’s nosy about Lumo’s encryption I’ve cooked up a handy debug command. 

(Think of it as the “peek‑aboo” feature for the crypto‑wizard inside.)

```
curl http://localhost:3333 \
  -X POST \
  -H 'Content-Type: application/json' \
  -d '{"prompt":"What is the weather in Zurich?", "webSearch":true, "debug":true}'
```

```
cat debug.json
```

Fake raw data but is like this how the log looks like:

```
"Prompt":{"type":"generation_request","turns":[{"role":"user","content":"W8DyNAHDsJf2H6oQ",
  "encrypted":true}],"options":{"tools":["proton_info"]},"targets":["title","message"],"request_key":"wV4D598Sio/F3gQSAQdAG37c1Ls3hiuhaY=","request_id":"6ddtsrdsa5f-3235-41be-edc"}}
```



NOTE : The debug commands takes a little longer to get answer




You can combine them all


```
curl http://localhost:3333 \
 -X POST \
 -H 'Content-Type: application/json' \
 -d '{"prompt":"What is the weather in Zurich?", "webSearch":true, "debug":true, "log":true}'
```


### Know 🐞 bugs

- The first prompt sometimes fails or is truncated
   - Cause: Slow network or lumo takes longer to load 
- Just wait and try again


Now you are Mater in Proton APIS

Lumo API and VPN API are now married you get encrypted love and secure connections out of the box!

Did you tried the VPN API? [Give a Try](https://github.com/carlostkd/proton-vpn-api)

## 🙏 Support the Project

If you find Lumo API useful, consider buying me a coffee (or a whole espresso machine). 

Your donation helps keep the AI sharp, the jokes fresh, and the servers humming.  

[Donate Here ➡️](https://donate.stripe.com/8wM6pe9DD99xgAofYZ?locale=en&__embed_source=buy_btn_1Oi3L8AtK4E7C1uiKA4WkkML)

### Contributing 💡

If you'd like to contribute to this project, feel free to fork it, make changes, and open a pull request!

Any improvement, whether big or small, is welcome. 🌱


