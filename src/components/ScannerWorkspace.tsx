'use client';
import { useState } from 'react';
import PhoneScanner from './PhoneScanner';
import BatchScanner from './BatchScanner';
import styles from './BatchScanner.module.css';
export default function ScannerWorkspace(){
 const [mode,setMode]=useState<'single'|'batch'>('batch');
 return <div id="main-content"><div className={styles.switcher} aria-label="Scanner mode"><button aria-pressed={mode==='batch'} onClick={()=>setMode('batch')}>Batch scan</button><button aria-pressed={mode==='single'} onClick={()=>setMode('single')}>Single card</button></div><div hidden={mode!=='batch'}><BatchScanner/></div><div hidden={mode!=='single'}><PhoneScanner/></div></div>;
}
