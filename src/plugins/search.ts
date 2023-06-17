import * as vscode from 'vscode';
import { chromium } from 'playwright';

export async function google(query: string) {

  try {
    const config = vscode.workspace.getConfiguration();
    const proxy = config.get<string>('http.proxy');

    const browser = await chromium.launch(proxy ? {
      proxy: {
        server: proxy,
      }
    } : undefined);
    const page = await browser.newPage();
    await page.goto(`https://www.google.com/search?q=${encodeURI(query)}&lr=lang_en&hl=en`);

    const cardSectionNode = await page.$('.card-section');
    

    if(cardSectionNode) {
      const cardSectionText = await cardSectionNode.innerText();
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
