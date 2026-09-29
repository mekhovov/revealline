import { readFile,writeFile } from 'node:fs/promises';
import { createStoredStillIdentityCatalog } from '../../../../releases/source-23b886bbdbea/game/media-storage-record.mjs';
import { resolveEarnedPicture } from '../../../../releases/source-23b886bbdbea/game/ui/earned-picture.mjs';
const manifest=JSON.parse(await readFile(new URL('./frozen-media-manifest.json',import.meta.url)));
const library=JSON.parse(await readFile(new URL('./native-player-library.json',import.meta.url)));
const item=library.gallery[0],receipt=library.pictureReceipts[0];
const catalog=createStoredStillIdentityCatalog(manifest.document);
const identity=catalog.resolve({executionKey:item.campaignKey,levelId:item.levelId,levelRevision:item.levelRevision,themeId:item.themeId});
let picture,error;
try{picture=resolveEarnedPicture({item,receipt,metadata:{document:manifest.document},entries:[]});}catch(e){error=e.message;}
const result={identity,receiptIdentity:receipt.presentationPin.identity,archivedPictureResolves:!!picture,error:error??null};console.log(JSON.stringify(result));await writeFile(new URL('./frozen-owner-result.json',import.meta.url),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
