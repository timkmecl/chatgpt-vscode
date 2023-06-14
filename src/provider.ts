import * as vscode from 'vscode';
import { ChatGPTAPI } from 'chatgpt';
import { AuthInfo, ConversationInfo, Settings } from './type';

export const BASE_URL = 'https://api.openai.com/v1';

export class ChatGPTViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'chatgpt.chatView';
	/**
	 * the webview
	 */
	private _view?: vscode.WebviewView;

	/**
	 * the API instance
	 */
	private _chatGPTAPI?: ChatGPTAPI;

	/**
	 * last conversation info
	 */
	private _conversation: ConversationInfo | null = null;

	/**
	 * the last response
	 * only save the nomal response, unexcept the error info
	 */
	private _response?: string;

	/**
	 * the current prompt
	 */
	private _prompt?: string;

	/**
	 * the current message id
	 * 
	 * if the current message id is different from the message id in callback
	 * it means that the callback is out date
	 */
	private _currentMessageNumber = 0;

	private _settings: Settings = {
		selectedInsideCodeblock: false,
		codeblockWithLanguageId: false,
		pasteOnClick: true,
		keepConversation: true,
		timeoutLength: 60,
		apiUrl: BASE_URL,
		model: 'gpt-3.5-turbo',
		temperature: 0.9,
		maxTokens: 2048,
	};
	private _authInfo?: AuthInfo;

	// In the constructor, we store the URI of the extension
	constructor(private readonly _extensionUri: vscode.Uri) {}
	
	/**
	 * Set the API key and create a new API instance based on this key
	 */
	public setAuthenticationInfo(authInfo: AuthInfo) {
		this._authInfo = authInfo;
		this._newAPI();
	}

	public setSettings(settings: Settings) {
		this._settings = {...this._settings, ...settings};
		this._newAPI();
	}

	public getSettings() {
		return this._settings;
	}

	/**
	 * This private method initializes a new ChatGPTAPI instance
	 */
	private _newAPI() {
		console.log("New API");
		if (!this._authInfo || !this._settings?.apiUrl) {
			console.warn("API key or API URL not set, please go to extension settings (read README.md for more info)");
			this._chatGPTAPI = undefined;
		}else{
			let maxModelTokens = 4096;
			if(this._settings.model?.match(/.*16k.*/)?.length) {
				maxModelTokens = 16384;
			} else if(this._settings.model?.match(/.*32k.*/)?.length) {
				maxModelTokens = 32768;
			}
			this._chatGPTAPI = new ChatGPTAPI({
				apiKey: this._authInfo.apiKey || "",
				apiBaseUrl: this._settings.apiUrl || BASE_URL,
				maxModelTokens: maxModelTokens,
				maxResponseTokens: this._settings.maxTokens || 1000,
				completionParams: { 
					model: this._settings.model || "gpt-3.5-turbo",
					temperature: this._settings.temperature || 0.9,
				},
			});
			// console.log( this._chatGPTAPI );
		}
	}

	public resolveWebviewView(
		webviewView: vscode.WebviewView,
		context: vscode.WebviewViewResolveContext,
		_token: vscode.CancellationToken,
	) {
		this._view = webviewView;

		// set options for the webview, allow scripts
		webviewView.webview.options = {
			enableScripts: true,
			localResourceRoots: [
				this._extensionUri
			]
		};

		// set the HTML for the webview
		webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

		// add an event listener for messages received by the webview
		webviewView.webview.onDidReceiveMessage(data => {
			switch (data.type) {
				case 'codeSelected':
					{
						// do nothing if the pasteOnClick option is disabled
						if (!this._settings.pasteOnClick) {
							break;
						}
						let code = data.value;
						const snippet = new vscode.SnippetString();
						snippet.appendText(code);
						// insert the code as a snippet into the active text editor
						vscode.window.activeTextEditor?.insertSnippet(snippet);
						break;
					}
				case 'prompt':
					{
						this.search(data.value);
						break;
					}
				case 'clear':
					{
						this.resetConversation();
						break;
					}
			}
		});
	}


	public async resetConversation() {
		console.log(this._conversation);
		this._conversation = null;

		this._prompt = '';
		this._response = '';
		this._view?.webview.postMessage({ type: 'setPrompt', value: '' });
		this._view?.webview.postMessage({ type: 'addResponse', value: '' });
	}

	/**
	 * send message to chatgpt api
	 */
	public async search(prompt?: string) {
		this._prompt = prompt;
		if (!prompt) {
			prompt = '';
			throw new Error('Prompt is empty');
		};

		// Check if the ChatGPTAPI instance is defined
		if (!this._chatGPTAPI) {
			this._newAPI();
		}

		// focus gpt activity from activity bar
		if (!this._view) {
			await vscode.commands.executeCommand('chatgpt.chatView.focus');
		}
		this._view?.show?.(true);
		
		/**
		 * the current response
		 */
		let response = '';
		// clear the last response
		this._response = '';

		// Get the selected text of the active editor
		const selection = vscode.window.activeTextEditor?.selection;
		const selectedText = vscode.window.activeTextEditor?.document.getText(selection);

		// Get the language id of the selected text of the active editor
		// If a user does not want to append this information to their prompt, leave it as an empty string
		const languageId = (this._settings.codeblockWithLanguageId ? vscode.window.activeTextEditor?.document?.languageId : undefined) || "";


		if (selection && selectedText) {
			// If there is a selection, add the prompt and the selected text to the search prompt
			if (this._settings.selectedInsideCodeblock) {
				this._prompt = `${prompt}\n\`\`\`${languageId}\n${selectedText}\n\`\`\``;
			} else {
				this._prompt = `${prompt}\n${selectedText}\n`;
			}
		} else {
			// Otherwise, just use the prompt if user typed it
			this._prompt = prompt;
		}
		
		// Increment the message number
		this._currentMessageNumber++;
		const currentMessageNumber = this._currentMessageNumber;

		if (!this._chatGPTAPI) {
			response = '[ERROR] "API key not set or wrong, please go to extension settings to set it (read README.md for more info)"';
		} else {
			// If successfully signed in
			console.log("sendMessage");
			
			// Make sure the prompt is shown
			// and only show input prompt
			this._view?.webview.postMessage({ type: 'setPrompt', value: prompt });
			this._view?.webview.postMessage({ type: 'addResponse', value: '...' });

			const agent = this._chatGPTAPI;

			try {
				console.log({
					prompt: this._prompt,
				});
				// Send the search prompt to the ChatGPTAPI instance and store the response
				const res = await agent.sendMessage(this._prompt, {
					onProgress: (partialResponse) => {
						// If the message number has changed, don't show the partial response
						if (this._currentMessageNumber !== currentMessageNumber) {
							return;
						}
						console.log("onProgress");
						if (this._view && this._view.visible) {
							response = partialResponse.text;
							this._response = response;
							this._view.webview.postMessage({ type: 'addResponse', value: response });
						}
					},
					timeoutMs: (this._settings.timeoutLength || 60) * 1000,
					...this._conversation || {},
				});

				if (this._currentMessageNumber !== currentMessageNumber) {
					return;
				}

				console.log(res);

				response = res.text;
				if (res.detail?.usage?.total_tokens) {
					response += `\n\n---\n*<sub>Tokens used: ${res.detail.usage.total_tokens} (${res.detail.usage.prompt_tokens}+${res.detail.usage.completion_tokens})</sub>*`;
				}

				if (this._settings.keepConversation){
					this._conversation = {
						parentMessageId: res.id
					};
				}

			} catch (e:any) {
				console.error(e);
				if (this._currentMessageNumber === currentMessageNumber){
					response = this._response;
					response += `\n\n---\n[ERROR] ${e}`;
				}
			}
		}

		if (this._currentMessageNumber !== currentMessageNumber) {
			return;
		}

		// Saves the response
		// this._response = response;

		// Show the view and send a message to the webview with the response
		if (this._view) {
			this._view.show?.(true);
			this._view.webview.postMessage({ type: 'addResponse', value: response });
		}
	}

	private _getHtmlForWebview(webview: vscode.Webview) {

		const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'main.js'));
		const microlightUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'scripts', 'microlight.min.js'));
		const tailwindUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'scripts', 'showdown.min.js'));
		const showdownUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'scripts', 'tailwind.min.js'));

		return `<!DOCTYPE html>
			<html lang="en">
			<head>
				<meta charset="UTF-8">
				<meta name="viewport" content="width=device-width, initial-scale=1.0">
				<script src="${tailwindUri}"></script>
				<script src="${showdownUri}"></script>
				<script src="${microlightUri}"></script>
				<style>
				.code {
					white-space: pre;
				}
				p {
					padding-top: 0.3rem;
					padding-bottom: 0.3rem;
				}
				/* overrides vscodes style reset, displays as if inside web browser */
				ul, ol {
					list-style: initial !important;
					margin-left: 10px !important;
				}
				h1, h2, h3, h4, h5, h6 {
					font-weight: bold !important;
				}
				</style>
			</head>
			<body>
				<div class="w-full flex">
					<input class="flex-1 h-10 text-white bg-stone-700 p-4 text-sm" placeholder="Ask ChatGPT something" id="prompt-input" />
					<button class="h-10 ml-2 px-2 text-gray-300 hover:text-white bg-stone-700" id="new_btn">New</button>
					</div>
				<p class="my-2 text-gray-600 text-sm">Press <span class="px-1 bg-grag-200">Command/Ctrl + Entry</span> to send request.</p>
				
				<div id="response" class="pt-4 text-sm">
				</div>

				<script src="${scriptUri}"></script>
			</body>
			</html>`;
	}
}
