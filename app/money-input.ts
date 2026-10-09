export function formatMoneyInput(value:string|number){
 const digits=String(value).replace(/\D/g,'').replace(/^0+(?=\d)/,'');
 const groups=digits.replace(/\B(?=(\d{3})+(?!\d))/g,'.').split('.');
 return groups.map((g,i)=>i&&((groups.length-i)%2===0)?"'"+g:i?'.'+g:g).join('');
}
