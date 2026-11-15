/* 六種出席狀態；舊版 absent 保留為未分類請假。 */
(function(root){
  'use strict';
  const statuses=[
    {id:'',label:'出席',short:'出席'}, {id:'sick',label:'病假',short:'病假'},
    {id:'personal',label:'事假',short:'事假'}, {id:'bereavement',label:'喪假',short:'喪假'},
    {id:'late',label:'遲到',short:'遲到'}, {id:'early',label:'早退',short:'早退'}
  ];
  const excluded=new Set(['absent','sick','personal','bereavement','early']);
  const valid=value=>value==='absent'||statuses.some(s=>s.id===value);
  const label=value=>value==='absent'?'請假（未分類）':(statuses.find(s=>s.id===value)||statuses[0]).label;
  const next=value=>statuses[(statuses.findIndex(s=>s.id===value)+1)%statuses.length].id;
  const api={statuses,valid,label,next,isExcluded:value=>excluded.has(value)};
  root.PetAttendance=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);
