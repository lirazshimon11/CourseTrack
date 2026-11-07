import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source=(await readFile(new URL('../public/pdf-reader.mjs',import.meta.url),'utf8')).replace(/^import .*;$/m,'');
test('local PDF adapter sorts positioned rows, handles pages and releases the document',async()=>{
 let destroyed=false;let options;
 const items=[{str:'50060-1',transform:[1,0,0,1,300,600],height:10},{str:'א',transform:[1,0,0,1,500,600],height:10},{str:'08:00',transform:[1,0,0,1,450,600],height:10},{str:'11:00',transform:[1,0,0,1,400,600],height:10},{str:'מסלול',transform:[1,0,0,1,500,700],height:10}];
 const getDocument=o=>{options=o;return {promise:Promise.resolve({numPages:2,getPage:async()=>({getTextContent:async()=>({items}),cleanup(){}})}),destroy:async()=>{destroyed=true;}};};
 const win={};const worker={};new Function('getDocument','GlobalWorkerOptions','window',source)(getDocument,worker,win);
 const result=await win.courseTrackReadPdf(new ArrayBuffer(5));
 assert.equal(result,'מסלול\nא 08:00 11:00 50060-1\nמסלול\nא 08:00 11:00 50060-1');
 assert.equal(destroyed,true);assert.equal(options.isEvalSupported,false);assert.equal(options.url,undefined);assert.equal(worker.workerSrc,'/pdfjs/pdf.worker.mjs');
});
