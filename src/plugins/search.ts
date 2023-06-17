import * as vscode from 'vscode';
import puppeteer, { type PuppeteerLaunchOptions } from 'puppeteer-core';

export async function google(query: string) {

  try {
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


    const browser = await puppeteer.launch(launchOptions);
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
      const resNodes = Array.from(rsoNode?.children || []).slice(0, 5);
      
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
