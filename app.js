/* =========================================================
   한국 편의점 알바 급여관리 — app.js
   Vanilla JS, no build step. LocalStorage-backed SPA.
   ========================================================= */
"use strict";

const STORE_KEY   = "cst_records_v1";
const SETTINGS_KEY= "cst_settings_v1";
const BACKUP_KEY  = "cst_backup_v1";

const DEFAULT_SETTINGS = {
  defaultWage: 10030,
  defaultBreak: 30,
  overtimeMultiplier: 1.5,
  darkMode: false,
  autoBackup: true,
  lastBackup: null
};

/* ---------------- state ---------------- */
let records = [];
let settings = { ...DEFAULT_SETTINGS };
let calCursor = new Date(); // month currently shown in calendar
let charts = {};
let editingId = null;

/* ---------------- utils ---------------- */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function uid(){ return Date.now().toString(36) + Math.random().toString(36).slice(2,8); }

function won(n){
  n = Math.round(n || 0);
  return "₩" + n.toLocaleString("ko-KR");
}

function pad2(n){ return String(n).padStart(2,"0"); }

function toDateStr(d){ return `${d.getFullYear()}-${pad2(d.getMonth()+1)}-${pad2(d.getDate())}`; }

function todayStr(){ return toDateStr(new Date()); }

function startOfWeek(d){
  const day = new Date(d);
  const diff = day.getDay(); // 0 = Sunday
  day.setDate(day.getDate() - diff);
  day.setHours(0,0,0,0);
  return day;
}

function showToast(msg){
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(showToast._timer);
  showToast._timer = setTimeout(()=>{ t.hidden = true; }, 2200);
}

/* ---------------- persistence ---------------- */
function loadAll(){
  try{
    const r = localStorage.getItem(STORE_KEY);
    records = r ? JSON.parse(r) : [];
  }catch(e){ records = []; }
  try{
    const s = localStorage.getItem(SETTINGS_KEY);
    settings = s ? { ...DEFAULT_SETTINGS, ...JSON.parse(s) } : { ...DEFAULT_SETTINGS };
  }catch(e){ settings = { ...DEFAULT_SETTINGS }; }
}

function saveRecords(){
  localStorage.setItem(STORE_KEY, JSON.stringify(records));
  if(settings.autoBackup){
    localStorage.setItem(BACKUP_KEY, JSON.stringify({ records, settings, savedAt: new Date().toISOString() }));
    settings.lastBackup = new Date().toISOString();
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  }
}

function saveSettings(){
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

/* ---------------- calculation ---------------- */
function calcHours(rec){
  const [sh, sm] = rec.startTime.split(":").map(Number);
  const [eh, em] = rec.endTime.split(":").map(Number);
  let startMin = sh*60+sm;
  let endMin = eh*60+em;
  if(endMin <= startMin) endMin += 24*60; // overnight shift
  let totalMin = endMin - startMin - (Number(rec.breakMinutes)||0);
  if(totalMin < 0) totalMin = 0;
  return totalMin / 60;
}

function calcPay(rec){
  const hours = calcHours(rec);
  const wage = Number(rec.hourlyWage) || 0;
  const mult = Number(settings.overtimeMultiplier) || 1;
  let basePay;
  if(hours > 8){
    basePay = 8*wage + (hours-8)*wage*mult;
  }else{
    basePay = hours*wage;
  }
  const allowance = (Number(rec.transport)||0) + (Number(rec.meal)||0);
  const bonus = Number(rec.bonus)||0;
  const deduction = Number(rec.deduction)||0;
  const total = basePay + allowance + bonus - deduction;
  return { hours, basePay, allowance, bonus, deduction, total };
}

/* ---------------- home stats ---------------- */
function renderHome(){
  const now = new Date();
  const today = todayStr();
  const weekStart = startOfWeek(now);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  let sToday=0, sWeek=0, sMonth=0, sYear=0, sTotal=0, hTotal=0, unpaid=0, paid=0;
  let monthDaysWithIncome = new Set();

  records.forEach(r=>{
    const { hours, total } = calcPay(r);
    const d = new Date(r.date + "T00:00:00");
    sTotal += total;
    hTotal += hours;
    if(r.date === today) sToday += total;
    if(d >= weekStart) sWeek += total;
    if(d >= monthStart){ sMonth += total; monthDaysWithIncome.add(r.date); }
    if(d >= yearStart) sYear += total;
    if(r.status === "paid") paid += total; else unpaid += total;
  });

  // projected income this month
  const dayOfMonth = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth()+1, 0).getDate();
  const projected = dayOfMonth > 0 ? (sMonth / dayOfMonth) * daysInMonth : 0;

  const avgWage = hTotal > 0 ? sTotal / hTotal : 0;

  $("#receiptDate").textContent = now.toLocaleDateString("ko-KR", { year:"numeric", month:"2-digit", day:"2-digit" }).replace(/\. /g,".").replace(/\.$/,"");
  $("#statToday").textContent = won(sToday);
  $("#statWeek").textContent = won(sWeek);
  $("#statMonth").textContent = won(sMonth);
  $("#statTotal").textContent = won(sTotal);
  $("#statYear").textContent = won(sYear);
  $("#statHours").textContent = hTotal.toFixed(1) + "시간";
  $("#statProjected").textContent = won(projected);
  $("#statAvgWage").textContent = won(avgWage);
  $("#statUnpaid").textContent = won(unpaid);
  $("#statPaid").textContent = won(paid);

  renderStoreFilterOptions();
  renderRecordList();
}

function renderStoreFilterOptions(){
  const sel = $("#filterStore");
  const current = sel.value;
  const stores = Array.from(new Set(records.map(r=>r.storeName).filter(Boolean))).sort();
  sel.innerHTML = `<option value="">전체 점포</option>` + stores.map(s=>`<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join("");
  sel.value = stores.includes(current) ? current : "";

  const datalist = $("#storeSuggestions");
  datalist.innerHTML = stores.map(s=>`<option value="${escapeHtml(s)}">`).join("");
}

function escapeHtml(str){
  return String(str).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

/* ---------------- record list ---------------- */
function getFilteredRecords(){
  const q = $("#searchInput").value.trim().toLowerCase();
  const storeF = $("#filterStore").value;
  const statusF = $("#filterStatus").value;
  const sortV = $("#sortOrder").value;

  let list = records.filter(r=>{
    if(storeF && r.storeName !== storeF) return false;
    if(statusF && r.status !== statusF) return false;
    if(q){
      const hay = `${r.storeName} ${r.note||""} ${r.address||""}`.toLowerCase();
      if(!hay.includes(q)) return false;
    }
    return true;
  });

  list.sort((a,b)=>{
    if(sortV === "date-asc") return a.date.localeCompare(b.date);
    if(sortV === "date-desc") return b.date.localeCompare(a.date);
    const pa = calcPay(a).total, pb = calcPay(b).total;
    if(sortV === "pay-desc") return pb - pa;
    if(sortV === "pay-asc") return pa - pb;
    return 0;
  });
  return list;
}

const STATUS_LABEL = { unpaid:"🟡 미결산", settled:"🔵 결산됨", paid:"🟢 수령완료" };

function renderRecordList(){
  const list = getFilteredRecords();
  const container = $("#recordList");
  $("#emptyState").hidden = records.length > 0;
  if(list.length === 0){
    container.innerHTML = "";
    return;
  }
  container.innerHTML = list.map(r=>{
    const { hours, total } = calcPay(r);
    const dateLabel = new Date(r.date+"T00:00:00").toLocaleDateString("ko-KR", { month:"long", day:"numeric", weekday:"short" });
    return `
    <div class="record-card" data-id="${r.id}">
      <div class="record-top">
        <div>
          <div class="record-store">${escapeHtml(r.storeName)}</div>
          <div class="record-date">${dateLabel} · ${r.startTime}–${r.endTime} · ${hours.toFixed(1)}시간</div>
        </div>
        <div class="record-pay">${won(total)}</div>
      </div>
      <div class="record-meta">
        <span class="chip status-${r.status}">${STATUS_LABEL[r.status]}</span>
        ${r.note ? `<span class="chip">📝 ${escapeHtml(r.note.slice(0,16))}${r.note.length>16?"…":""}</span>` : ""}
      </div>
      <div class="record-actions">
        <button data-act="edit">수정</button>
        <button data-act="dup">복제</button>
        <button data-act="cycle">상태변경</button>
        <button data-act="del" class="danger">삭제</button>
      </div>
    </div>`;
  }).join("");
}

function onRecordListClick(e){
  const btn = e.target.closest("button[data-act]");
  if(!btn) return;
  const card = e.target.closest(".record-card");
  const id = card.dataset.id;
  const rec = records.find(r=>r.id===id);
  if(!rec) return;
  const act = btn.dataset.act;
  if(act === "edit"){ openForm(rec); }
  else if(act === "dup"){ duplicateRecord(rec); }
  else if(act === "del"){ deleteRecord(id); }
  else if(act === "cycle"){ cycleStatus(rec); }
}

function cycleStatus(rec){
  const order = ["unpaid","settled","paid"];
  const idx = order.indexOf(rec.status);
  rec.status = order[(idx+1) % order.length];
  saveRecords();
  refreshAll();
  showToast(`상태 변경: ${STATUS_LABEL[rec.status]}`);
}

function duplicateRecord(rec){
  const copy = { ...rec, id: uid(), date: todayStr() };
  records.unshift(copy);
  saveRecords();
  refreshAll();
  showToast("기록이 복제되었습니다");
}

function deleteRecord(id){
  if(!confirm("이 근무 기록을 삭제할까요?")) return;
  records = records.filter(r=>r.id!==id);
  saveRecords();
  refreshAll();
  showToast("삭제되었습니다");
}

/* ---------------- form ---------------- */
function openForm(rec){
  editingId = rec ? rec.id : null;
  $("#formTitle").textContent = rec ? "근무 기록 수정" : "근무 기록 추가";
  $("#submitBtn").textContent = rec ? "수정 저장" : "저장하기";

  $("#recordId").value = rec ? rec.id : "";
  $("#f_date").value = rec ? rec.date : todayStr();
  $("#f_store").value = rec ? rec.storeName : "";
  $("#f_address").value = rec ? (rec.address||"") : "";
  $("#f_owner").value = rec ? (rec.owner||"") : "";
  $("#f_contact").value = rec ? (rec.contact||"") : "";
  $("#f_start").value = rec ? rec.startTime : "09:00";
  $("#f_end").value = rec ? rec.endTime : "18:00";
  $("#f_break").value = rec ? rec.breakMinutes : settings.defaultBreak;
  $("#f_wage").value = rec ? rec.hourlyWage : settings.defaultWage;
  $("#f_transport").value = rec ? rec.transport : 0;
  $("#f_meal").value = rec ? rec.meal : 0;
  $("#f_bonus").value = rec ? rec.bonus : 0;
  $("#f_deduction").value = rec ? rec.deduction : 0;
  $("#f_note").value = rec ? (rec.note||"") : "";
  const status = rec ? rec.status : "unpaid";
  $$('input[name="f_status"]').forEach(el => el.checked = el.value === status);

  updateCalcPreview();
  goToPage("add");
}

function readFormRecord(){
  return {
    id: $("#recordId").value || uid(),
    date: $("#f_date").value,
    storeName: $("#f_store").value.trim(),
    address: $("#f_address").value.trim(),
    owner: $("#f_owner").value.trim(),
    contact: $("#f_contact").value.trim(),
    startTime: $("#f_start").value,
    endTime: $("#f_end").value,
    breakMinutes: Number($("#f_break").value)||0,
    hourlyWage: Number($("#f_wage").value)||0,
    transport: Number($("#f_transport").value)||0,
    meal: Number($("#f_meal").value)||0,
    bonus: Number($("#f_bonus").value)||0,
    deduction: Number($("#f_deduction").value)||0,
    note: $("#f_note").value.trim(),
    status: $$('input[name="f_status"]:checked')[0]?.value || "unpaid"
  };
}

function updateCalcPreview(){
  const draft = readFormRecord();
  if(!draft.startTime || !draft.endTime){ return; }
  const { hours, basePay, allowance, bonus, deduction, total } = calcPay(draft);
  $("#calcHours").textContent = hours.toFixed(1) + "시간";
  $("#calcBase").textContent = won(basePay);
  $("#calcAllowance").textContent = won(allowance + bonus);
  $("#calcDeduction").textContent = "- " + won(deduction);
  $("#calcTotal").textContent = won(total);
}

function onFormSubmit(e){
  e.preventDefault();
  const data = readFormRecord();
  if(!data.storeName || !data.date || !data.startTime || !data.endTime){
    showToast("필수 항목을 입력해주세요");
    return;
  }
  const idx = records.findIndex(r=>r.id===data.id);
  if(idx >= 0){ records[idx] = data; showToast("수정되었습니다"); }
  else{ records.unshift(data); showToast("저장되었습니다"); }
  saveRecords();
  editingId = null;
  goToPage("home");
  refreshAll();
}

/* ---------------- calendar ---------------- */
function renderCalendar(){
  const y = calCursor.getFullYear();
  const m = calCursor.getMonth();
  $("#calLabel").textContent = `${y}년 ${m+1}월`;

  const firstDay = new Date(y, m, 1);
  const startOffset = firstDay.getDay();
  const daysInMonth = new Date(y, m+1, 0).getDate();

  const byDate = {};
  records.forEach(r=>{
    (byDate[r.date] ||= []).push(r);
  });

  let html = "";
  for(let i=0;i<startOffset;i++) html += `<div class="cal-day empty"></div>`;

  const todayS = todayStr();
  for(let d=1; d<=daysInMonth; d++){
    const dateStr = `${y}-${pad2(m+1)}-${pad2(d)}`;
    const dayRecs = byDate[dateStr] || [];
    let cls = "cal-day";
    let payLabel = "";
    if(dayRecs.length){
      const hasPaid = dayRecs.some(r=>r.status==="paid");
      const hasSettled = dayRecs.some(r=>r.status==="settled");
      const hasUnpaid = dayRecs.some(r=>r.status==="unpaid");
      if(hasPaid) cls += " has-paid";
      else if(hasSettled) cls += " has-settled";
      else if(hasUnpaid) cls += " has-unpaid";
      const dayTotal = dayRecs.reduce((s,r)=>s+calcPay(r).total,0);
      payLabel = (dayTotal/10000).toFixed(1)+"만";
    }
    if(dateStr === todayS) cls += " is-today";
    html += `<div class="${cls}" data-date="${dateStr}"><span class="d-num">${d}</span>${payLabel?`<span class="d-pay">${payLabel}</span>`:""}</div>`;
  }
  $("#calendarGrid").innerHTML = html;
  $("#calDayDetail").hidden = true;
}

function onCalendarClick(e){
  const cell = e.target.closest(".cal-day:not(.empty)");
  if(!cell) return;
  const date = cell.dataset.date;
  const dayRecs = records.filter(r=>r.date===date);
  const box = $("#calDayDetail");
  const dateLabel = new Date(date+"T00:00:00").toLocaleDateString("ko-KR",{ month:"long", day:"numeric", weekday:"long" });
  if(dayRecs.length === 0){
    box.innerHTML = `<h4>${dateLabel}</h4><p class="hint">이 날은 휴무예요. 근무 기록이 없습니다.</p>`;
  }else{
    const dayTotal = dayRecs.reduce((s,r)=>s+calcPay(r).total,0);
    box.innerHTML = `<h4>${dateLabel} · <span class="mono">${won(dayTotal)}</span></h4>` +
      dayRecs.map(r=>{
        const { hours, total } = calcPay(r);
        return `<div class="record-card" style="margin-bottom:8px;" data-id="${r.id}">
          <div class="record-top">
            <div>
              <div class="record-store">${escapeHtml(r.storeName)}</div>
              <div class="record-date">${r.startTime}–${r.endTime} · ${hours.toFixed(1)}시간</div>
            </div>
            <div class="record-pay">${won(total)}</div>
          </div>
          <div class="record-meta"><span class="chip status-${r.status}">${STATUS_LABEL[r.status]}</span></div>
          <div class="record-actions"><button data-act="edit">수정</button></div>
        </div>`;
      }).join("");
  }
  box.hidden = false;
  box.querySelectorAll('button[data-act="edit"]').forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const id = btn.closest(".record-card").dataset.id;
      const rec = records.find(r=>r.id===id);
      if(rec) openForm(rec);
    });
  });
}

/* ---------------- charts ---------------- */
function chartTheme(){
  const dark = document.documentElement.getAttribute("data-theme") === "dark";
  return {
    grid: dark ? "rgba(255,255,255,.08)" : "rgba(18,23,43,.08)",
    text: dark ? "#9198C0" : "#6b7290",
    iris: "#5B8DEF",
    amber: "#FFB020",
    mint: "#2DD4BF"
  };
}

function destroyCharts(){
  Object.values(charts).forEach(c=>c && c.destroy());
  charts = {};
}

function buildChart(id, type, labels, data, color, label){
  const t = chartTheme();
  const ctx = document.getElementById(id).getContext("2d");
  charts[id] = new Chart(ctx, {
    type,
    data: {
      labels,
      datasets: [{
        label,
        data,
        borderColor: color,
        backgroundColor: type === "line" ? color+"33" : color,
        borderRadius: type === "bar" ? 8 : 0,
        tension: .35,
        fill: type === "line",
        pointRadius: type === "line" ? 2 : 0,
        borderWidth: 2
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { display:false } },
      scales: {
        x: { ticks:{ color:t.text, font:{ size:10 } }, grid:{ color:"transparent" } },
        y: { ticks:{ color:t.text, font:{ size:10 } }, grid:{ color:t.grid }, beginAtZero:true }
      }
    }
  });
}

function lastNDates(n){
  const arr = [];
  for(let i=n-1;i>=0;i--){
    const d = new Date();
    d.setDate(d.getDate()-i);
    arr.push(toDateStr(d));
  }
  return arr;
}

function lastNMonths(n){
  const arr = [];
  const now = new Date();
  for(let i=n-1;i>=0;i--){
    const d = new Date(now.getFullYear(), now.getMonth()-i, 1);
    arr.push(`${d.getFullYear()}-${pad2(d.getMonth()+1)}`);
  }
  return arr;
}

function renderCharts(){
  destroyCharts();
  const t = chartTheme();

  // Daily wage (last 14 days)
  const days = lastNDates(14);
  const dailyMap = {};
  records.forEach(r=>{ dailyMap[r.date] = (dailyMap[r.date]||0) + calcPay(r).total; });
  buildChart("chartDaily", "bar", days.map(d=>d.slice(5)), days.map(d=>dailyMap[d]||0), t.iris, "일별 급여");

  // Weekly wage (last 8 weeks)
  const weekLabels = [];
  const weekData = [];
  for(let i=7;i>=0;i--){
    const ws = startOfWeek(new Date());
    ws.setDate(ws.getDate() - i*7);
    const we = new Date(ws); we.setDate(we.getDate()+6);
    const sum = records.filter(r=>{
      const d = new Date(r.date+"T00:00:00");
      return d >= ws && d <= we;
    }).reduce((s,r)=>s+calcPay(r).total,0);
    weekLabels.push(`${ws.getMonth()+1}/${ws.getDate()}`);
    weekData.push(sum);
  }
  buildChart("chartWeekly", "bar", weekLabels, weekData, t.amber, "주별 급여");

  // Monthly wage & hours (last 6 months)
  const months = lastNMonths(6);
  const monthPay = {}, monthHours = {};
  records.forEach(r=>{
    const key = r.date.slice(0,7);
    const { hours, total } = calcPay(r);
    monthPay[key] = (monthPay[key]||0) + total;
    monthHours[key] = (monthHours[key]||0) + hours;
  });
  buildChart("chartMonthly", "bar", months.map(m=>m.slice(5)+"월"), months.map(m=>monthPay[m]||0), t.mint, "월별 급여");
  buildChart("chartMonthlyHours", "bar", months.map(m=>m.slice(5)+"월"), months.map(m=>(monthHours[m]||0).toFixed ? +((monthHours[m]||0).toFixed(1)) : 0), t.iris, "월별 근무시간");

  // Trends (line)
  buildChart("chartWageTrend", "line", days.map(d=>d.slice(5)), days.map(d=>dailyMap[d]||0), t.amber, "급여 추이");
  const dailyHoursMap = {};
  records.forEach(r=>{ dailyHoursMap[r.date] = (dailyHoursMap[r.date]||0) + calcPay(r).hours; });
  buildChart("chartHoursTrend", "line", days.map(d=>d.slice(5)), days.map(d=>+((dailyHoursMap[d]||0).toFixed(1))), t.mint, "근무시간 추이");
}

/* ---------------- export / import ---------------- */
function buildExportRows(){
  return records.map(r=>{
    const { hours, basePay, allowance, total } = calcPay(r);
    return {
      "날짜": r.date, "점포명": r.storeName, "주소": r.address, "사장님": r.owner, "연락처": r.contact,
      "출근": r.startTime, "퇴근": r.endTime, "휴게(분)": r.breakMinutes, "시급": r.hourlyWage,
      "근무시간": +hours.toFixed(2), "기본급": Math.round(basePay), "교통비": r.transport, "식대": r.meal,
      "보너스": r.bonus, "공제": r.deduction, "실수령액": Math.round(total), "상태": STATUS_LABEL[r.status], "메모": r.note
    };
  });
}

function downloadBlob(content, filename, type){
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  URL.revokeObjectURL(url);
}

function exportCSV(){
  const rows = buildExportRows();
  if(rows.length===0){ showToast("내보낼 기록이 없습니다"); return; }
  const headers = Object.keys(rows[0]);
  const csv = [headers.join(","), ...rows.map(row => headers.map(h=>{
    const v = String(row[h] ?? "").replace(/"/g,'""');
    return `"${v}"`;
  }).join(","))].join("\r\n");
  downloadBlob("\uFEFF"+csv, `salary_${todayStr()}.csv`, "text/csv;charset=utf-8;");
  showToast("CSV 내보내기 완료");
}

function exportExcel(){
  const rows = buildExportRows();
  if(rows.length===0){ showToast("내보낼 기록이 없습니다"); return; }
  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "급여기록");
  XLSX.writeFile(wb, `salary_${todayStr()}.xlsx`);
  showToast("Excel 내보내기 완료");
}

function exportJSON(){
  const payload = { records, settings, exportedAt: new Date().toISOString() };
  downloadBlob(JSON.stringify(payload, null, 2), `salary_backup_${todayStr()}.json`, "application/json");
  showToast("JSON 내보내기 완료");
}

function importJSONFile(file){
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const data = JSON.parse(reader.result);
      const incoming = Array.isArray(data) ? data : (data.records || []);
      if(!Array.isArray(incoming)) throw new Error("invalid");
      const existingIds = new Set(records.map(r=>r.id));
      let added = 0;
      incoming.forEach(r=>{
        if(!r.id || existingIds.has(r.id)) r.id = uid();
        records.push(r); added++;
      });
      saveRecords();
      refreshAll();
      showToast(`${added}개 기록을 가져왔습니다`);
    }catch(e){
      showToast("가져오기 실패: 올바른 JSON 파일이 아닙니다");
    }
  };
  reader.readAsText(file);
}

function doBackup(){
  const payload = { records, settings, savedAt: new Date().toISOString() };
  localStorage.setItem(BACKUP_KEY, JSON.stringify(payload));
  settings.lastBackup = payload.savedAt;
  saveSettings();
  updateBackupHint();
  downloadBlob(JSON.stringify(payload, null, 2), `salary_manual_backup_${todayStr()}.json`, "application/json");
  showToast("백업이 완료되었습니다");
}

function doRestoreFromFile(file){
  const reader = new FileReader();
  reader.onload = () => {
    try{
      const data = JSON.parse(reader.result);
      if(!confirm("현재 데이터를 백업 파일 내용으로 교체할까요?")) return;
      records = data.records || [];
      settings = { ...DEFAULT_SETTINGS, ...(data.settings||{}) };
      saveRecords(); saveSettings();
      applyTheme();
      refreshAll();
      renderSettingsForm();
      showToast("복원이 완료되었습니다");
    }catch(e){
      showToast("복원 실패: 올바른 백업 파일이 아닙니다");
    }
  };
  reader.readAsText(file);
}

function restoreFromLocalBackup(){
  const raw = localStorage.getItem(BACKUP_KEY);
  if(!raw){ showToast("저장된 자동 백업이 없습니다"); return; }
  if(!confirm("가장 최근 자동 백업으로 복원할까요?")) return;
  const data = JSON.parse(raw);
  records = data.records || [];
  settings = { ...DEFAULT_SETTINGS, ...(data.settings||{}) };
  saveRecords(); saveSettings();
  applyTheme();
  refreshAll();
  renderSettingsForm();
  showToast("자동 백업으로 복원되었습니다");
}

/* ---------------- settings ---------------- */
function renderSettingsForm(){
  $("#s_defaultWage").value = settings.defaultWage;
  $("#s_defaultBreak").value = settings.defaultBreak;
  $("#s_overtimeMultiplier").value = settings.overtimeMultiplier;
  $("#s_darkMode").checked = settings.darkMode;
  $("#s_autoBackup").checked = settings.autoBackup;
  updateBackupHint();
}

function updateBackupHint(){
  const el = $("#autoBackupHint");
  el.textContent = settings.lastBackup
    ? `마지막 자동 백업: ${new Date(settings.lastBackup).toLocaleString("ko-KR")}`
    : "마지막 자동 백업: -";
}

function onSaveSettings(){
  settings.defaultWage = Number($("#s_defaultWage").value)||0;
  settings.defaultBreak = Number($("#s_defaultBreak").value)||0;
  settings.overtimeMultiplier = Number($("#s_overtimeMultiplier").value)||1;
  settings.darkMode = $("#s_darkMode").checked;
  settings.autoBackup = $("#s_autoBackup").checked;
  saveSettings();
  applyTheme();
  refreshAll();
  showToast("설정이 저장되었습니다");
}

function applyTheme(){
  document.documentElement.setAttribute("data-theme", settings.darkMode ? "dark" : "light");
}

/* ---------------- navigation ---------------- */
function goToPage(name){
  $$(".page").forEach(p=>p.classList.remove("active"));
  $(`#page-${name}`).classList.add("active");
  $$(".nav-btn").forEach(b=>b.classList.toggle("active", b.dataset.page===name));
  window.scrollTo({ top:0, behavior:"instant" in window ? "instant" : "auto" });
  if(name === "calendar") renderCalendar();
  if(name === "stats") renderCharts();
  if(name === "add" && editingId === null){
    // fresh add (not triggered via openForm with a record) — reset only if not mid-edit
  }
}

/* ---------------- refresh ---------------- */
function refreshAll(){
  renderHome();
  if($("#page-calendar").classList.contains("active")) renderCalendar();
  if($("#page-stats").classList.contains("active")) renderCharts();
}

/* ---------------- init ---------------- */
function bindEvents(){
  $$(".nav-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      const page = btn.dataset.page;
      if(page === "add") openForm(null);
      else goToPage(page);
    });
  });
  $("#fabAddBtn").addEventListener("click", ()=>openForm(null));
  $("#openAddFromList").addEventListener("click", ()=>openForm(null));
  $("#cancelFormBtn").addEventListener("click", ()=>{ editingId=null; goToPage("home"); });

  $("#recordForm").addEventListener("submit", onFormSubmit);
  ["f_start","f_end","f_break","f_wage","f_transport","f_meal","f_bonus","f_deduction"].forEach(id=>{
    $("#"+id).addEventListener("input", updateCalcPreview);
  });

  $("#recordList").addEventListener("click", onRecordListClick);
  $("#searchInput").addEventListener("input", renderRecordList);
  $("#filterStore").addEventListener("change", renderRecordList);
  $("#filterStatus").addEventListener("change", renderRecordList);
  $("#sortOrder").addEventListener("change", renderRecordList);

  $("#calPrev").addEventListener("click", ()=>{ calCursor.setMonth(calCursor.getMonth()-1); renderCalendar(); });
  $("#calNext").addEventListener("click", ()=>{ calCursor.setMonth(calCursor.getMonth()+1); renderCalendar(); });
  $("#calendarGrid").addEventListener("click", onCalendarClick);

  $("#themeToggleBtn").addEventListener("click", ()=>{
    settings.darkMode = !settings.darkMode;
    saveSettings();
    applyTheme();
    renderSettingsForm();
    if($("#page-stats").classList.contains("active")) renderCharts();
  });

  $("#saveSettingsBtn").addEventListener("click", onSaveSettings);
  $("#exportCsvBtn").addEventListener("click", exportCSV);
  $("#exportExcelBtn").addEventListener("click", exportExcel);
  $("#exportJsonBtn").addEventListener("click", exportJSON);
  $("#importJsonBtn").addEventListener("click", ()=>$("#importFileInput").click());
  $("#importFileInput").addEventListener("change", (e)=>{ if(e.target.files[0]) importJSONFile(e.target.files[0]); e.target.value=""; });
  $("#backupBtn").addEventListener("click", doBackup);
  $("#restoreBtn").addEventListener("click", ()=>{
    if(confirm("파일에서 복원하려면 확인, 최근 자동 백업에서 복원하려면 취소를 누르세요.")){
      $("#restoreFileInput").click();
    }else{
      restoreFromLocalBackup();
    }
  });
  $("#restoreFileInput").addEventListener("change", (e)=>{ if(e.target.files[0]) doRestoreFromFile(e.target.files[0]); e.target.value=""; });
  $("#clearAllBtn").addEventListener("click", ()=>{
    if(confirm("정말 모든 데이터를 삭제할까요? 이 작업은 되돌릴 수 없습니다.")){
      records = [];
      saveRecords();
      refreshAll();
      showToast("모든 데이터가 삭제되었습니다");
    }
  });
}

function init(){
  loadAll();
  applyTheme();
  renderSettingsForm();
  bindEvents();
  goToPage("home");
  refreshAll();

  if("serviceWorker" in navigator){
    window.addEventListener("load", ()=>{
      navigator.serviceWorker.register("service-worker.js").catch(()=>{});
    });
  }
}

document.addEventListener("DOMContentLoaded", init);
