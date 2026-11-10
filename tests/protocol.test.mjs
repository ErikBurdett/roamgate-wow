import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { fields, parseFields, encodeFrame, Assembler, WIDTH, HEIGHT, CELL, COLS, decodePixels, decodeMonoPixels, parsePPM } from '../bridge/protocol.mjs';
import { lua } from '../bridge/files.mjs';
const packet = (text = 'Hello\n你好 | Héllo : "\\') => fields(['0123456789abcdef', 1, 1, 'message', 'w1:p1', 'term', 'proof', text, '', 1]);
test('UTF-8 length-prefixed message preserves arbitrary plain text', () => { assert.equal(parseFields(packet()).text, 'Hello\n你好 | Héllo : "\\'); });
test('Lua and JS generate byte-identical optical frames', () => {
  const actual = execFileSync('lua5.1', ['tests/wire.lua']);
  assert.deepEqual(actual, encodeFrame(packet(), 0, 1));
});
test('fragment reassembly handles order, repetitions, and UTF-8 split boundaries', () => {
  const body = packet('你好🌍\n'.repeat(390)); const a = new Assembler(), frames = [];
  for (let i = 0; i < Math.ceil(body.length / 600); i++) frames.push(encodeFrame(body, i));
  let decoded;
  for (const f of frames.reverse()) { decoded = a.accept(f); a.accept(f); }
  assert.equal(decoded.text, '你好🌍\n'.repeat(390));
});
test('corrupt data and invalid frame bounds never become commands', () => {
  const frame = encodeFrame(packet(), 0); frame[30] ^= 1; assert.equal(new Assembler().accept(frame), null);
  for (const [offset, n] of [[9,255], [8,20], [10,255], [20,255]]) { const f = encodeFrame(packet(),0); f[offset]=n; assert.equal(new Assembler().accept(f),null); }
});
test('new command never mixes with fragments from the previous command', () => {
  const a = new Assembler(), first = packet('a'.repeat(2000)), second = packet('b'.repeat(2000));
  a.accept(encodeFrame(first,0)); a.accept(encodeFrame(first,1));
  a.accept(encodeFrame(second,2)); assert.equal(a.accept(encodeFrame(second,3)),null);
});
test('screen cells tolerate small rounding but reject unrelated pixels', () => {
  const f = encodeFrame(packet(),0), rgb = Buffer.alloc(WIDTH*HEIGHT*3);
  for (let i=0;i<f.length;i++) for(let y=0;y<CELL;y++) for(let x=0;x<CELL;x++) {
    const p=((Math.floor(i/COLS)*CELL+y)*WIDTH+(i%COLS)*CELL+x)*3;
    rgb[p]=16+Math.floor(f[i]/16)*14+1; rgb[p+1]=16+(f[i]%16)*14-1; rgb[p+2]=180;
  }
  assert.deepEqual(decodePixels(rgb,WIDTH,HEIGHT),f);
  rgb[(2*WIDTH+2)*3+2]=0;assert.equal(decodePixels(rgb,WIDTH,HEIGHT),null);
});
test('PPM parser does not swallow whitespace-valued first pixels', () => {
  const bytes=Buffer.from([10,13,32]); const ppm=Buffer.concat([Buffer.from('P6\n# capture\n1 1\n255\n'),bytes]);
  assert.deepEqual(parsePPM(ppm).rgb,bytes);assert.throws(()=>parsePPM(ppm.subarray(0,-1)));
});
test('malformed fields and unknown commands fail closed', () => {
  for(const bad of [Buffer.from('99:hi'),fields(['x',1,1,'message','','','','','','1']),fields(['0123456789abcdef',1,1,'shell','','','','','','1'])]) assert.throws(()=>parseFields(bad));
});
test('compact monochrome strip decodes with unused padding hidden', () => {
  const body=packet(),f=encodeFrame(body,0),width=512,height=10,rgb=Buffer.alloc(width*height*3,79);
  for(let i=0;i<24+body.length;i++) for(let half=0;half<2;half++) for(let y=0;y<2;y++) for(let x=0;x<2;x++) {
    const value=16+(half===0?Math.floor(f[i]/16):f[i]%16)*14;
    const p=((Math.floor(i/128)*2+y)*width+(i%128)*4+half*2+x)*3;rgb.fill(value,p,p+3);
  }
  const decoded=decodeMonoPixels(rgb,width,height);assert.ok(decoded);assert.equal(new Assembler().accept(decoded).text,parseFields(body).text);
});
test('Lua serialization treats quotes, escapes, Unicode and code as data', () => {
  const value='雪\n"; os.exit(7); -- \\ |Tfoo|t\u0000';
  const script=`local s=${lua(value)}; io.write(s)`;
  assert.deepEqual(execFileSync('lua5.1',['-e',script]),Buffer.from(value));
});
