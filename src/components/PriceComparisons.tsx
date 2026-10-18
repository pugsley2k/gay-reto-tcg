import type {PriceComparison} from '@/lib/graded-pricing';
import styles from './ScanReview.module.css';
export default function PriceComparisons({items,onUse}:{items?:PriceComparison[];onUse:(price:string)=>void}){
 if(!items?.length)return null;
 return <section className={styles.review} aria-label="Market price comparisons"><h3>Market price comparisons</h3><p>These are references for the same printing. Different graders and ungraded condition are different markets; these figures do not establish your slab’s value.</p>{items.map(item=><div className={styles.warning} key={`${item.company}-${item.grade}-${item.url}`}>
 <strong>{item.company==='Ungraded'?(item.basis==='sold'?'Ungraded sale':'Ungraded market guide'):`${item.company} ${item.grade}`} · £{item.gbp}</strong>
 <p>{item.source} · {item.basis==='sold'?'Reported completed sale':'Guide value'} · {item.date_kind==='accessed'?'Accessed ':''}{item.updated.slice(0,10)}<br/>{item.original} {item.currency}{item.currency!=='GBP'?` · GBP conversion dated ${item.rate_date}`:''}</p>
 <p><a href={item.url} target="_blank" rel="noopener noreferrer">View source ↗</a></p><button type="button" onClick={()=>onUse(item.gbp)}>Use £{item.gbp} as my starting price</button>
 </div>)}</section>;
}
