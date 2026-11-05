import { describe, expect, it } from 'vitest';
import { parseHistoricalPage, historicalProductFacts, reconcileHistoricalTotals, type HistoricalWord } from '../lib/browser-history-extractor';
const word=(text:string,x0:number,top:number,x1=x0+20):HistoricalWord=>({text,x0,x1,top,bottom:top+8});
describe('historical table geometry',()=>{
 it('keeps wrapped descriptions, arbitrary grouped codes, last dimensions and original units',()=>{
 const page=parseHistoricalPage([word('FG1 / FG2',20,120,50),word('Fixed glass 1 x 3 profile',60,112,290),word('1.20 (L) x 2.40',60,125,290),word('2',420,120),word('set',445,120),word('1, 250.00',480,120,550),word('2,500.00',570,120,650)], [100,150],false);
 expect(page.items).toHaveLength(1);expect(page.items[0]).toMatchObject({code:'FG1 / FG2',widthM:1.2,heightM:2.4,unit:'set',rate:1250,total:2500,quantity:2});
 });
 it('preserves a printed total mismatch for review',()=>{expect(reconcileHistoricalTotals([36720],[],[33840])).toMatchObject({computed:36720,printed:33840,reconciled:false});});
 it('does not invent dimension or drawing content on empty cells',()=>{const page=parseHistoricalPage([word('Screen repair',60,120,290),word('1',420,120),word('LS',445,120),word('900.00',480,120,550),word('900.00',570,120,650)],[100,150],false);expect(page.items[0].widthM).toBeUndefined();expect(page.items[0].code).toBe('');});
});

it('uses source categories and explicit product specifications',()=>{
 expect(historicalProductFacts('900 Series Sliding Door, Wood Finish, 6mm Tempered Clear Glass')).toMatchObject({category:'Doors',series:'900 Series',glass:'6mm Tempered Clear Glass',color:'Wood Finish'});
 expect(historicalProductFacts('Jalouplus Jalousy Blades, 6mm Annealed Clear Glass')).toMatchObject({category:'Others',series:'Jalouplus'});
 expect(historicalProductFacts('Glass Partition with door, HA')).toMatchObject({category:'Others',color:'HA'});
 expect(historicalProductFacts('Canvas Canopy')).toMatchObject({category:'Others'});
});
