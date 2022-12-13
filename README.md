# ChatGPT extension for VSCode

This Visual Studio Code extension allows you to use the [unofficial ChatGPT API](https://github.com/transitive-bullshit/chatgpt-api) to generate natural language responses from OpenAI's [ChatGPT](https://chat.openai.com/chat) to your questions, right within the editor.

🤖✨ Supercharge your coding with AI-powered assistance. Automatically write new code from scratch, ask questions, get explanations, refactor code, find bugs and more!

### [Marketplace](https://marketplace.visualstudio.com/items?itemName=timkmecl.chatgpt), [Github](https://github.com/timkmecl/chatgpt-vscode)

<br>

### ⚠️⚠️**IMPORTANT!**⚠️⚠️ Due to breaking changes in ChatGPT on Dec 12., update the extension and read the new instructions on [obtaining the tokens](#obtaining-the-three-tokens)!

<br>

<img src="examples/main.png" alt="Refactoring selected code using chatGPT"/>

## Features
- **Ask general questions** or use code snippets from the editor to query ChatGPT via an input box in the sidebar
- Right click on a code selection and run one of the context menu **shortcuts**
- View ChatGPT's responses in a panel next to the editor
- Ask **follow-up questions** to the response (conversation context is maintained)
- **Insert code snippets** from the AI's response into the active editor by clicking on them


## Installation

To use this extension, install it from the VSCode marketplace or download and install `.vsix` file from Releases.

1. After the installation is complete, you will need to add your ChatGPT tokens to the extension settings in VSCode. To do this, open the `Settings` panel by going to the `Code` menu and selecting `Preferences`, then `Settings`.
2. In the search bar, type `ChatGPT` to filter the settings list.
3. In the ChatGPT section, enter your session tokens in the top three field

After completing these steps, the extension should be ready to use. 

There were som

### Obtaining the three tokens

To use this extension, you will need to authenticate with valid token sfrom ChatGPT. To get a session token:

1. Go to https://chat.openai.com/chat and log in or sign up.
2. Open the developer tools in your browser.
3. Go to the `Application` tab and open the `Cookies` section.
4. Copy the value for `__Secure-next-auth.session-token` and paste it into the `Session Token` field in the extension settings, and the value for `cf_clearance` into the `Clearance Token` field.
5. Go to the `Network` tab and select any request.
6. Copy the value for `user-agent` from the `Request Headers` and paste it into the `User Agent` field in the extension settings (it should look something like this: *`Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/108.0.0.0 Safari/537.36 Edg/108.0.1462.46`*)
6. Alternatively, type `navigator.userAgent` in the `Console` tab and copy the result without the quotes.

#### Update December 12, 2022

Yesterday, OpenAI added additional Cloudflare protections that make it more difficult to access the unofficial API. That's why you now need to set three different parameters instead of just the `Session Token`. There are also several **limitations** now (copied from [chatgpt-api](https://github.com/transitive-bullshit/chatgpt-api)):
- Cloudflare `cf_clearance` **tokens expire after 2 hours**, so right now we recommend that you refresh your `cf_clearance` token every ~45 minutes or so.
- Your `user-agent` and `IP address` **must match** from the real browser window you're logged in with to the one you're using for `ChatGPTAPI`.
- You must use **`node >= 18`**. Type `node -v` in the terminal to check you version.
- You should **not be using this account while the extension is using it**, because that browser window may refresh one of your tokens and invalidate the extension's session.


## Using the Extension

To use the extension, open a text editor in Visual Studio Code and open the ChatGPT panel by clicking on the ChatGPT icon in the sidebar. This will open a panel with an input field where you can enter your prompt or question. By clicking enter, it will be sent to ChatGPT. Its response will be displayed below the input field in the sidebar (note that it may take some time for it to be calculated).

<img src="examples/create.png" alt="Writing new code using chatGPT" width="500"/>

You can also select a code snippet in the editor and then enter a prompt in the side panel, or right-click and select "Ask ChatGPT". The **selected code will be automatically appended** to your query when it is sent to the AI. This can be useful for generating code snippets or getting explanations for specific pieces of code.

<img src="examples/explain.png" alt="Refactoring selected code using chatGPT"/>

To **insert a code snippet** from the AI's response into the editor, simply click on the code block in the panel. The code will be automatically inserted at the cursor position in the active editor.

<img src="examples/refactor.png" alt="chatGPT explaining selected code"/>

You can select some code in the editor, right click on it and choose one of the following **shortcuts** from the context menu:
#### Commands:
- `Ask ChatGPT`: will provide a prompt for you to enter any query
- `ChatGPT: Explain selection`: will explain what the selected code does
- `ChatGPT: Refactor selection`: will try to refactor the selected code
- `ChatGPT: Find problems`: looks for problems/errors in the selected code, fixes and explains them
- `ChatGPT: Optimize selection`: tries to optimize the selected code

`Ask ChatGPT` is also available when nothing is selected. For the other four commands, you can **customize the exact prompt** that will be sent to the AI by editing the extension settings in VSCode Preferences.


Because ChatGPT is a conversational AI, you can ask follow-up questions to the response. The conversation context is maintained between queries, so you can ask multiple questions in a row. 
To **reset the conversation context**, click `ctrl+shift+p` and select `ChatGPT: Reset Conversation`.


## Common issues


- *ERROR 403 forbidden*: Make sure you exactly followed [these instruction on obtaining the tokens](#obtaining-the-three-tokens). If you still get this error, check wheteher your node version is >= 18. Otherwise check [this list](#update-december-12-2022) for other potential issues caused by OpenAI's use of CloudFlare. *Some users still seem to have issues with this even when following the instructions (see [here](https://github.com/mpociot/chatgpt-vscode/issues/15)), so if you have any ideas on how to fix this, please let me know.*
- *ERROR 429 too many requests*: This can be solved by using `ctrl+shift+p` and selecting `ChatGPT: Reset Conversation` (but it will also delete the current conversation context). It can be caused by sending requests too quickly, but also when the previous request timeouted. If it keeps happening try increasing the timeout in the extension settings. *Also it looks like OpenAI now sends a timeout after about a minute which also causes this when it happens (see [this](https://github.com/transitive-bullshit/chatgpt-api/issues/111)), I am currently trying to find a way to fix this.*

---

Please note that this extension is currently a proof of concept and may have some limitations or bugs. We welcome feedback and contributions to improve the extension.


## Credits

- This wouldn't be possible without OpenAI's [ChatGPT](https://chat.openai.com/chat)
- The extension makes use of [chatgpt-api](https://github.com/transitive-bullshit/chatgpt-api) (by [Travis Fischer](https://github.com/transitive-bullshit)), which uses ChatGPT unofficial API in order to login and communicate with it.
- It is built on top of [mpociot/chatgpt-vscode](https://github.com/mpociot/chatgpt-vscode), which started this project
- `v0.3` inspired and based on [barnesoir/chatgpt-vscode-plugin](https://github.com/barnesoir/chatgpt-vscode-plugin) and [gencay/vscode-chatgpt](https://github.com/gencay/vscode-chatgpt)