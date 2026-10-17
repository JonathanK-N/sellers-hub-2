// Author: Jonathan Kakesa. Session waterfall regression without network access.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
(async()=>{
 const {earlySessionScript}=await import(pathToFileURL(path.join(__dirname,'../frontend/build-tools/early_session.mjs')).href);
 const script=earlySessionScript('https://session.invalid');
 const source=fs.readFileSync(path.join(__dirname,'../frontend/src/lib/session_api.js'),'utf8').replace('import { API_BASE } from "./api_config";','const API_BASE="https://session.invalid/api";');
 const {verifySession}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
 const originalFetch=global.fetch,originalWindow=global.window;
 let calls=[];
 function run(token,status=200){
  const window={};let timer=0;
  vm.runInNewContext(script.replace(/^<script[^>]*>/,'').replace(/<\/script>$/,''),{window,localStorage:{getItem:()=>token},AbortController,Date,setTimeout:()=>++timer,clearTimeout:()=>{},fetch:async(url,options)=>{calls.push({url,options});return new Response(JSON.stringify({id:'fixture',role:'buyer'}),{status});}});
  global.window=window;return window;
 }
 try{
  run(null);assert.equal(calls.length,0);
  run('initial-fixture');assert.equal(calls.length,1,'Session starts before application verifier');
  global.fetch=()=>{throw Error('Duplicate session request');};
  assert.equal((await verifySession('initial-fixture')).role,'buyer');assert.equal(calls.length,1);assert.equal(window.__afriInitialSession,undefined);
  assert.equal(calls[0].url,'https://session.invalid/api/auth/me');assert.equal(calls[0].options.cache,'no-store');assert.equal(calls[0].options.credentials,'omit');assert.equal(calls[0].options.body,undefined);
  run('expired-fixture',401);await assert.rejects(verifySession('expired-fixture'),e=>e.response?.status===401);
  run('old-fixture');let refreshed=0;global.fetch=async(url,options)=>{refreshed++;assert.equal(options.headers.Authorization,'Bearer new-fixture');return new Response(JSON.stringify({id:'new-user',role:'seller'}),{status:200});};
  assert.equal((await verifySession('new-fixture')).role,'seller');assert.equal(refreshed,1,'Changed token cannot consume stale session response');
  assert(!earlySessionScript('https://session.invalid/</script>').includes('</script>\"'));
  console.log('PASS: early session only, one verification, no cookie/cache/body, expired response rejected, changed token isolated');
 }finally{global.fetch=originalFetch;if(originalWindow===undefined)delete global.window;else global.window=originalWindow;}
})().catch(error=>{console.error(error.message);process.exitCode=1;});
