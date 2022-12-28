import * as vscode from 'vscode';
import { ChatGPTAPI, ChatGPTConversation } from 'chatgpt';


type AuthInfo = {sessionToken?: string, clearanceToken?: string, userAgent?: string};
type Settings = {selectedInsideCodeblock?: boolean, pasteOnClick?: boolean, keepConversation?: boolean, timeoutLength?: number};


export function activate(context: vscode.ExtensionContext) {
	// Get the API session token from the extension's configuration
	const config = vscode.workspace.getConfiguration('chatgpt');

	// Create a new ChatGPTViewProvider instance and register it with the extension's context
	const provider = new ChatGPTViewProvider(context.extensionUri);

	// Put configuration settings into the provider
	provider.setAuthenticationInfo({
		sessionToken: config.get('sessionToken'), 
		clearanceToken: config.get('clearanceToken'), 
		userAgent: config.get('userAgent')
	});
	provider.setSettings({
		selectedInsideCodeblock: config.get('selectedInsideCodeblock') || false,
		pasteOnClick: config.get('pasteOnClick') || false,
		keepConversation: config.get('keepConversation') || false,
		timeoutLength: config.get('timeoutLength') || 60,
	});

	// Register the provider with the extension's context
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(ChatGPTViewProvider.viewType, provider,  {
			webviewOptions: { retainContextWhenHidden: true }
		})
	);


	const commandHandler = (command:string) => {
		const config = vscode.workspace.getConfiguration('chatgpt');
		const prompt = config.get(command) as string;
		provider.search(prompt);
	};
	
	const setConversationId = () => {
		vscode.window.showInputBox({ 
			prompt: 'Set Conversation ID or delete it to reset the conversation',
			placeHolder: 'conversationId (leave empty to reset)',
			value: provider.getConversationId()
		}).then((conversationId) => {
			if (!conversationId) {
				provider.setConversationId();
			} else {
				vscode.window.showInputBox({ 
					prompt: 'Set Parent Message ID',
					placeHolder: 'messageId (leave empty to reset)',
					value: provider.getParentMessageId()
				}).then((messageId) => {
					provider.setConversationId(conversationId, messageId);
				});
			}
		});
	};

	// Register the commands that can be called from the extension's package.json
	context.subscriptions.push(
		vscode.commands.registerCommand('chatgpt.ask', () => 
			vscode.window.showInputBox({ prompt: 'What do you want to do?' })
			.then((value) => provider.search(value))
		),
		vscode.commands.registerCommand('chatgpt.explain', () => commandHandler('promptPrefix.explain')),
		vscode.commands.registerCommand('chatgpt.refactor', () => commandHandler('promptPrefix.refactor')),
		vscode.commands.registerCommand('chatgpt.optimize', () => commandHandler('promptPrefix.optimize')),
		vscode.commands.registerCommand('chatgpt.findProblems', () => commandHandler('promptPrefix.findProblems')),
		vscode.commands.registerCommand('chatgpt.resetConversation', provider.resetConversation),
		vscode.commands.registerCommand('chatgpt.conversationId', setConversationId)
	);


	// Change the extension's session token or settings when configuration is changed
	vscode.workspace.onDidChangeConfiguration((event: vscode.ConfigurationChangeEvent) => {
		if (event.affectsConfiguration('chatgpt.sessionToken') || event.affectsConfiguration('chatgpt.clearanceToken') || event.affectsConfiguration('chatgpt.userAgent')) {
			const config = vscode.workspace.getConfiguration('chatgpt');
			provider.setAuthenticationInfo({sessionToken: config.get('sessionToken'), clearanceToken: config.get('clearanceToken'), userAgent: config.get('userAgent')});
		} else if (event.affectsConfiguration('chatgpt.selectedInsideCodeblock')) {
			const config = vscode.workspace.getConfiguration('chatgpt');
			provider.setSettings({ selectedInsideCodeblock: config.get('selectedInsideCodeblock') || false });
		} else if (event.affectsConfiguration('chatgpt.pasteOnClick')) {
			const config = vscode.workspace.getConfiguration('chatgpt');
			provider.setSettings({ pasteOnClick: config.get('pasteOnClick') || false });
		} else if (event.affectsConfiguration('chatgpt.keepConversation')) {
			const config = vscode.workspace.getConfiguration('chatgpt');
			provider.setSettings({ keepConversation: config.get('keepConversation') || false });
		} else if (event.affectsConfiguration('chatgpt.timeoutLength')) {
			const config = vscode.workspace.getConfiguration('chatgpt');
			provider.setSettings({ timeoutLength: config.get('timeoutLength') || 60 });
		}
	});
}





class ChatGPTViewProvider implements vscode.WebviewViewProvider {
	public static readonly viewType = 'chatgpt.chatView';
	private _view?: vscode.WebviewView;

	private _chatGPTAPI?: ChatGPTAPI;
	private _conversation?: ChatGPTConversation;

	private _response?: string;
	private _prompt?: string;
	private _fullPrompt?: string;
	private _currentMessageNumber = 0;

	private _settings: Settings = {
		selectedInsideCodeblock: false,
		pasteOnClick: true,
		keepConversation: true,
		timeoutLength: 60
	};
	private _authInfo?: AuthInfo;

	// In the constructor, we store the URI of the extension
	constructor(private readonly _extensionUri: vscode.Uri) {

	}
	
	// Set the session token and create a new API instance based on this token
	public setAuthenticationInfo(authInfo: AuthInfo) {
		this._authInfo = authInfo;
		this._newAPI();
	}

	public setSettings(settings: Settings) {
		this._settings = {...this._settings, ...settings};
	}

	public getSettings() {
		return this._settings;
	}

	public setConversationId(conversationId?: string, parentMessageId?: string) {
		if (!conversationId || !parentMessageId) {
			this._conversation = this._chatGPTAPI?.getConversation();
		} else if (conversationId && parentMessageId) {
			this._conversation = this._chatGPTAPI?.getConversation({conversationId: conversationId, parentMessageId: parentMessageId});
		}
	}

	public getConversationId() {
		return this._conversation?.conversationId;
	}
	public getParentMessageId() {
		return this._conversation?.parentMessageId;
	}

	// This private method initializes a new ChatGPTAPI instance, using the session token if it is set
	private _newAPI() {
		if (!this._authInfo || !this._authInfo?.sessionToken || !this._authInfo?.clearanceToken || !this._authInfo?.userAgent) {
			console.warn("Session token or Clearance token not set, please go to extension settings (read README.md for more info)");
		}else{
			this._chatGPTAPI = new ChatGPTAPI({
				sessionToken: this._authInfo.sessionToken,
				clearanceToken: this._authInfo.clearanceToken,
				userAgent: this._authInfo.userAgent
			});
			this._conversation = this._chatGPTAPI.getConversation();
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
						code = code.replace(/([^\\])(\$)([^{0-9])/g, "$1\\$$$3");
						// insert the code as a snippet into the active text editor
						vscode.window.activeTextEditor?.insertSnippet(new vscode.SnippetString(code));
						break;
					}
				case 'prompt':
					{
						this.search(data.value);
					}
			}
		});
	}


	public async resetConversation() {
		this.setConversationId();
		this._prompt = '';
		this._response = '';
		this._fullPrompt = '';
		this._view?.webview.postMessage({ type: 'setPrompt', value: '' });
		this._view?.webview.postMessage({ type: 'addResponse', value: '' });
	}


	public async search(prompt?:string) {
		this._prompt = prompt;
		if (!prompt) {
			prompt = '';
		};

		// Check if the ChatGPTAPI instance is defined
		if (!this._chatGPTAPI) {
			this._newAPI();
		}

		// focus gpt activity from activity bar
		if (!this._view) {
			await vscode.commands.executeCommand('chatgpt.chatView.focus');
		} else {
			this._view?.show?.(true);
		}
		
		let response = '';
		this._response = '';
		// Get the selected text of the active editor
		const selection = vscode.window.activeTextEditor?.selection;
		const selectedText = vscode.window.activeTextEditor?.document.getText(selection);
		let searchPrompt = '';

		if (selection && selectedText) {
			// If there is a selection, add the prompt and the selected text to the search prompt
			if (this._settings.selectedInsideCodeblock) {
				searchPrompt = `${prompt}\n\`\`\`\n${selectedText}\n\`\`\``;
			} else {
				searchPrompt = `${prompt}\n${selectedText}\n`;
			}
		} else {
			// Otherwise, just use the prompt if user typed it
			searchPrompt = prompt;
		}
		this._fullPrompt = searchPrompt;

		if (!this._chatGPTAPI || !this._conversation) {
			response = '[ERROR] "Session Token, Clearance Token or User Agent not set, please go to extension settings to set them (read README.md for more info)"';
		} else {
			// If successfully signed in
			console.log("sendMessage");
			
			// Make sure the prompt is shown
			this._view?.webview.postMessage({ type: 'setPrompt', value: this._prompt });
			this._view?.webview.postMessage({ type: 'addResponse', value: '...' });

			// Increment the message number
			this._currentMessageNumber++;

			let agent;
			if (this._settings.keepConversation) {
				agent = this._conversation;
			} else {
				agent = this._chatGPTAPI;
			}

			try {
				// Send the search prompt to the ChatGPTAPI instance and store the response
				let currentMessageNumber = this._currentMessageNumber;
				response = await agent.sendMessage(searchPrompt, {
					onProgress: (partialResponse) => {
						// If the message number has changed, don't show the partial response
						if (this._currentMessageNumber !== currentMessageNumber) {
							return;
						}
						if (this._view && this._view.visible) {
							response = partialResponse;
							this._view.webview.postMessage({ type: 'addResponse', value: partialResponse });
						}
					},
					timeoutMs: (this._settings.timeoutLength || 60) * 1000
				});

				if (this._currentMessageNumber !== currentMessageNumber) {
					return;
				}
			} catch (e) {
				console.error(e);
				response += `\n\n---\n[ERROR] ${e}`;
			}
		}

		// Saves the response
		this._response = response;

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
					padding-top: 0.25rem;
					padding-bottom: 0.25rem;
				}
				</style>
			</head>
			<body>
				<input class="h-10 w-full text-white bg-stone-700 p-4 text-sm" placeholder="Ask ChatGPT something" id="prompt-input" />
				
				<div id="response" class="pt-4 text-sm">
				</div>

				<script src="${scriptUri}"></script>
			</body>
			</html>`;
	}
}

// This method is called when your extension is deactivated
export function deactivate() {}