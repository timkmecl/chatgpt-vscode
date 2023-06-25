export type AuthInfo = {apiKey: string};
export type Settings = {
	selectedInsideCodeblock?: boolean
	codeblockWithLanguageId?: false
	pasteOnClick?: boolean
	keepConversation?: boolean
	timeoutLength?: number
	model?: string
	apiUrl?: string
	temperature?: number
	maxTokens?: number
};

export type ConversationInfo = {
	parentMessageId: string
};
