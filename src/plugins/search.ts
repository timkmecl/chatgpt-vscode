import * as vscode from 'vscode';
import puppeteer from 'puppeteer-core';
import type {Browser, PuppeteerLaunchOptions} from 'puppeteer-core';

let browser: Browser | null = null;

export async function initBrowser() {
  let launchOptions: PuppeteerLaunchOptions = {};

    const config = vscode.workspace.getConfiguration();
    const proxy = config.get<string>('http.proxy');
    
    if(proxy) {
      launchOptions = {
        ...launchOptions,
        args: [`--proxy-server=${proxy}`]
      };
    }

    console.log(process.env);
    const executablePath = process.env.CHROMIUM_EXECUTABLE_PATH || config.get('chatgpt.chromiumExecutablePath');

    if(executablePath) {
      launchOptions = {
        ...launchOptions,
        executablePath
      };
    }

    browser = await puppeteer.launch(launchOptions);
}

vscode.workspace.onDidChangeConfiguration(async (event: vscode.ConfigurationChangeEvent) => {
  if (event.affectsConfiguration('chatgpt.chromiumExecutablePath')) {
    browser = null;
    await initBrowser();
  }
});

export async function google(query: string) {
  try {
    if(!browser) {
      await initBrowser();
      if(!browser) {
        return '';
      }
    }

    const page = await browser.newPage();
    await page.goto(`https://www.google.com/search?q=${encodeURI(query)}&lr=lang_en&hl=en`);

    const cardSectionNode = await page.$('.card-section');
    

    if(cardSectionNode) {
      const cardSectionText = await cardSectionNode.evaluate((node) => {
        return (node as HTMLElement).innerText;
      });
      return cardSectionText;
    }


    const data = await page.evaluate(() => {
      const rsoNode = document.querySelector('#rso');
      const resNodes = Array.from(rsoNode?.children || []).slice(0, 3);
      
      return resNodes.map((node) => {
        return (node as HTMLElement).innerText;
      });
    });

    return data.join('\n').trim() || '';
  } catch (err) {
    console.log(err);
    return '';
  }
}
