/**
 * SecLearn - 보안 학습 허브
 * 뉴스 스크랩 | 용어사전 | 학습 노트 | 참고 자료
 */

'use strict';

// ──────────────────────────────────────────
// 상태
// ──────────────────────────────────────────
const S = {
  section: 'news',
  news:      [],
  glossary:  [],
  notes:     [],
  resources: [],
  newsNotes: {},          // { newsId: '메모' }
  newsFilter: { q: '', cat: 'all' },
  glossaryFilter: { q: '', cat: 'all', alpha: 'all' },
  notesFilter: { q: '' },
  resourcesFilter: { q: '', cat: 'all' },
};

// ──────────────────────────────────────────
// 카테고리 메타
// ──────────────────────────────────────────
const NEWS_CATS = {
  cve:    { label: 'CVE',      color: '#f85149' },
  vuln:   { label: '취약점',   color: '#d29922' },
  breach: { label: '침해사고', color: '#bc8cff' },
  tools:  { label: '도구/기법',color: '#58a6ff' },
  policy: { label: '정책/공지',color: '#3fb950' },
  other:  { label: '기타',     color: '#8b949e' },
};
const GLOSSARY_CATS = {
  attack:  { label: '공격 기법' },
  defense: { label: '방어/보호' },
  crypto:  { label: '암호화' },
  network: { label: '네트워크' },
  tool:    { label: '도구/프레임워크' },
  concept: { label: '개념/용어' },
};
const RESOURCE_CATS = {
  course:  { label: '강의/코스' },
  docs:    { label: '문서/레퍼런스' },
  ctf:     { label: 'CTF/워게임' },
  tool:    { label: '도구' },
  blog:    { label: '블로그/아티클' },
  video:   { label: '영상' },
};

// ──────────────────────────────────────────
// 초기화
// ──────────────────────────────────────────
function init() {
  loadStorage();
  saveStorage();

  buildAlphaFilter();
  bindEvents();
  renderAll();
}

// ──────────────────────────────────────────
// 스토리지
// ──────────────────────────────────────────
function saveStorage() {
  try {
    ['news','glossary','notes','resources','newsNotes'].forEach(k =>
      localStorage.setItem('sl_' + k, JSON.stringify(S[k]))
    );
  } catch {}
}
function loadStorage() {
  ['news','glossary','notes','resources','newsNotes'].forEach(k => {
    try {
      const v = localStorage.getItem('sl_' + k);
      if (v) S[k] = JSON.parse(v);
    } catch {}
  });
}

// ──────────────────────────────────────────
// 이벤트 바인딩
// ──────────────────────────────────────────
function bindEvents() {
  // 탭 전환
  document.querySelectorAll('.nav-tab').forEach(btn => {
    btn.addEventListener('click', () => switchSection(btn.dataset.section));
  });

  // + 추가 버튼
  document.getElementById('addBtn').addEventListener('click', () => openAddModal());

  // 모달 닫기
  document.getElementById('modal-close').addEventListener('click', closeModal);
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('modal-overlay')) closeModal();
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

  // n8n 버튼
  document.getElementById('n8n-btn').addEventListener('click', openN8nModal);

  // 뉴스 초기화 버튼
  document.getElementById('news-clear-btn').addEventListener('click', () => {
    if (!confirm('뉴스 스크랩 데이터를 모두 삭제하시겠습니까?')) return;
    S.news = [];
    S.newsNotes = {};
    saveStorage();
    renderNews();
    updateSidebar();
    toast('뉴스 데이터가 초기화되었습니다', 'info');
  });

  // 검색 / 필터
  bindFilter('news-search',          v => { S.newsFilter.q = v; renderNews(); });
  bindFilter('news-cat-filter',      v => { S.newsFilter.cat = v; renderNews(); }, 'change');
  bindFilter('glossary-search',      v => { S.glossaryFilter.q = v; renderGlossary(); });
  bindFilter('glossary-cat-filter',  v => { S.glossaryFilter.cat = v; renderGlossary(); }, 'change');
  bindFilter('notes-search',         v => { S.notesFilter.q = v; renderNotes(); });
  bindFilter('resources-search',     v => { S.resourcesFilter.q = v; renderResources(); });
  bindFilter('resources-cat-filter', v => { S.resourcesFilter.cat = v; renderResources(); }, 'change');
}

function bindFilter(id, cb, evt = 'input') {
  const el = document.getElementById(id);
  if (!el) return;
  let t;
  el.addEventListener(evt, () => {
    clearTimeout(t);
    t = setTimeout(() => cb(el.value.trim()), evt === 'input' ? 220 : 0);
  });
}

// ──────────────────────────────────────────
// 섹션 전환
// ──────────────────────────────────────────
function switchSection(name) {
  S.section = name;
  document.querySelectorAll('.nav-tab').forEach(b =>
    b.classList.toggle('active', b.dataset.section === name)
  );
  document.querySelectorAll('.section').forEach(s =>
    s.classList.toggle('hidden', s.id !== 'section-' + name)
  );
  updateSidebar();
}

// ──────────────────────────────────────────
// 렌더 (전체)
// ──────────────────────────────────────────
function renderAll() {
  renderNews();
  renderGlossary();
  renderNotes();
  renderResources();
  updateSidebar();
}

// ──────────────────────────────────────────
// 뉴스 렌더
// ──────────────────────────────────────────
function renderNews() {
  const { q, cat } = S.newsFilter;
  let list = S.news.filter(n =>
    (cat === 'all' || n.category === cat) &&
    (!q || n.title.includes(q) || (n.summary || '').includes(q) || (n.source || '').includes(q))
  ).sort((a, b) => new Date(b.date) - new Date(a.date));

  const grid = document.getElementById('news-grid');
  const empty = document.getElementById('news-empty');
  if (!list.length) { grid.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  grid.innerHTML = list.map(n => {
    const cat = NEWS_CATS[n.category] || NEWS_CATS.other;
    const hasNote = S.newsNotes[n.id];
    const tags = (n.tags || []).map(t => `<span class="badge b-other">${esc(t)}</span>`).join('');
    return `
      <div class="news-card" data-id="${n.id}" style="--card-color:${cat.color}" onclick="openNewsDetail('${n.id}')">
        <div class="card-title">${esc(n.title)}</div>
        <div class="card-summary">${esc(n.summary || '')}</div>
        <div class="card-footer">
          <span class="badge b-${n.category}">${cat.label}</span>
          ${n.severity ? `<span class="sev sev-${n.severity}">${n.severity.toUpperCase()}</span>` : ''}
          ${tags}
          ${hasNote ? '<span class="has-note-dot" title="메모 있음"></span>' : ''}
          ${n.source ? `<span class="card-source">${esc(n.source)}</span>` : ''}
          <span class="card-date">${relDate(n.date)}</span>
        </div>
      </div>`;
  }).join('');
}

function openNewsDetail(id) {
  const n = S.news.find(x => x.id === id);
  if (!n) return;
  const cat = NEWS_CATS[n.category] || NEWS_CATS.other;
  const note = S.newsNotes[id] || '';
  const tags = (n.tags || []).map(t => `<span class="badge b-other">${esc(t)}</span>`).join('');

  openModal(esc(n.title), `
    <div class="detail-meta">
      <span class="badge b-${n.category}">${cat.label}</span>
      ${n.severity ? `<span class="sev sev-${n.severity}">${n.severity.toUpperCase()}</span>` : ''}
      ${tags}
      ${n.source ? `<span class="card-source">출처: ${esc(n.source)}</span>` : ''}
      <span class="card-date">${relDate(n.date)}</span>
    </div>
    <div class="detail-body">${esc(n.summary || '')}</div>
    ${n.url ? `<a href="${esc(n.url)}" target="_blank" rel="noopener" class="detail-link">&#128279; 원문 보기</a>` : ''}
    <div class="note-editor">
      <div class="note-editor-label">&#128221; 학습 메모</div>
      <textarea id="news-note-area" placeholder="이 뉴스에서 배운 점, 참고 사항을 메모하세요...">${esc(note)}</textarea>
      <div class="note-editor-actions">
        <button class="btn btn-primary btn-sm" onclick="saveNewsNote('${id}')">저장</button>
      </div>
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary btn-sm" onclick="openEditModal('news','${id}')">수정</button>
      <button class="btn btn-danger btn-sm" onclick="deleteItem('news','${id}')">삭제</button>
    </div>
  `, 'modal-lg');
}

function saveNewsNote(id) {
  const area = document.getElementById('news-note-area');
  if (!area) return;
  S.newsNotes[id] = area.value;
  saveStorage();
  renderNews();
  toast('메모 저장됨', 'success');
}

// ──────────────────────────────────────────
// 용어사전 렌더
// ──────────────────────────────────────────
function buildAlphaFilter() {
  const alphas = ['전체','A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z','가','나','다','라','마','바','사','아','자','차','카','타','파','하'];
  document.getElementById('alpha-filter').innerHTML = alphas.map(a =>
    `<button class="alpha-btn${a==='전체'?' active':''}" data-alpha="${a==='전체'?'all':a}" onclick="setAlpha(this,'${a==='전체'?'all':a}')">${a}</button>`
  ).join('');
}

function setAlpha(btn, val) {
  document.querySelectorAll('.alpha-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  S.glossaryFilter.alpha = val;
  renderGlossary();
}

function renderGlossary() {
  const { q, cat, alpha } = S.glossaryFilter;
  let list = S.glossary.filter(g => {
    if (cat !== 'all' && g.category !== cat) return false;
    if (alpha !== 'all') {
      const first = (g.term || '').charAt(0).toUpperCase();
      const firstKo = (g.term || '').charAt(0);
      if (/[A-Z]/.test(alpha)) { if (first !== alpha) return false; }
      else { // 한글 초성 범위 체크
        const start = alpha.charCodeAt(0);
        const end = start + 587; // 대략 한 자모 범위
        const code = firstKo.charCodeAt(0);
        if (code < start || code > end) return false;
      }
    }
    if (q) {
      const lq = q.toLowerCase();
      return (g.term||'').toLowerCase().includes(lq) || (g.eng||'').toLowerCase().includes(lq) || (g.definition||'').includes(q);
    }
    return true;
  }).sort((a,b) => (a.term||'').localeCompare(b.term||'', 'ko'));

  const el = document.getElementById('glossary-list');
  const empty = document.getElementById('glossary-empty');
  if (!list.length) { el.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  el.innerHTML = list.map(g => {
    const catMeta = GLOSSARY_CATS[g.category] || { label: g.category };
    const related = (g.related||[]).map(r => `<span class="g-rel-tag">${esc(r)}</span>`).join('');
    return `
      <div class="glossary-item" id="gi-${g.id}">
        <div class="glossary-header" onclick="toggleGlossary('${g.id}')">
          <span class="g-term">${esc(g.term)}</span>
          <span class="g-eng">${esc(g.eng||'')}</span>
          <span class="badge b-${g.category}">${catMeta.label}</span>
          ${g.difficulty ? `<span class="diff diff-${g.difficulty}">${{beginner:'입문',intermediate:'중급',advanced:'고급'}[g.difficulty]||g.difficulty}</span>` : ''}
          <span class="g-arrow">&#9660;</span>
        </div>
        <div class="glossary-body">
          <div class="g-definition">${esc(g.definition||'')}</div>
          ${g.example ? `<div class="g-example">${esc(g.example)}</div>` : ''}
          ${related ? `<div class="g-related">${related}</div>` : ''}
          <div class="g-actions">
            <button class="btn btn-secondary btn-sm" onclick="openEditModal('glossary','${g.id}')">수정</button>
            <button class="btn btn-danger btn-sm" onclick="deleteItem('glossary','${g.id}')">삭제</button>
          </div>
        </div>
      </div>`;
  }).join('');
}

function toggleGlossary(id) {
  const el = document.getElementById('gi-' + id);
  if (el) el.classList.toggle('open');
}

// ──────────────────────────────────────────
// 노트 렌더
// ──────────────────────────────────────────
function renderNotes() {
  const { q } = S.notesFilter;
  const NOTE_COLORS = ['#58a6ff','#00d4aa','#bc8cff','#d29922','#3fb950','#f85149'];
  let list = S.notes.filter(n =>
    !q || n.title.includes(q) || (n.content||'').includes(q) || (n.tags||[]).some(t=>t.includes(q))
  ).sort((a,b) => new Date(b.updated||b.date) - new Date(a.updated||a.date));

  const grid = document.getElementById('notes-grid');
  const empty = document.getElementById('notes-empty');
  if (!list.length) { grid.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  grid.innerHTML = list.map((n, i) => {
    const color = NOTE_COLORS[i % NOTE_COLORS.length];
    const tags = (n.tags||[]).map(t => `<span class="badge b-other">${esc(t)}</span>`).join('');
    return `
      <div class="note-card" style="--note-color:${color}" onclick="openNoteDetail('${n.id}')">
        <div class="note-title">${esc(n.title)}</div>
        <div class="note-preview">${esc(n.content||'')}</div>
        <div class="note-footer">
          ${tags}
          <span class="note-date">${relDate(n.updated||n.date)}</span>
        </div>
      </div>`;
  }).join('');
}

function openNoteDetail(id) {
  const n = S.notes.find(x => x.id === id);
  if (!n) return;
  const tags = (n.tags||[]).map(t => `<span class="badge b-other">${esc(t)}</span>`).join('');
  openModal(esc(n.title), `
    <div class="detail-meta">
      ${tags}
      <span class="card-date">${relDate(n.updated||n.date)}</span>
    </div>
    <div class="detail-body">${esc(n.content||'')}</div>
    <div class="form-actions">
      <button class="btn btn-secondary btn-sm" onclick="openEditModal('notes','${id}')">수정</button>
      <button class="btn btn-danger btn-sm" onclick="deleteItem('notes','${id}')">삭제</button>
    </div>
  `, 'modal-lg');
}

// ──────────────────────────────────────────
// 참고자료 렌더
// ──────────────────────────────────────────
function renderResources() {
  const { q, cat } = S.resourcesFilter;
  let list = S.resources.filter(r =>
    (cat === 'all' || r.category === cat) &&
    (!q || r.title.includes(q) || (r.description||'').includes(q) || (r.tags||[]).some(t=>t.includes(q)))
  );

  const grid = document.getElementById('resources-grid');
  const empty = document.getElementById('resources-empty');
  if (!list.length) { grid.innerHTML = ''; empty.style.display = 'block'; return; }
  empty.style.display = 'none';

  grid.innerHTML = list.map(r => {
    const catMeta = RESOURCE_CATS[r.category] || { label: r.category };
    const tags = (r.tags||[]).map(t => `<span class="badge b-other">${esc(t)}</span>`).join('');
    return `
      <div class="resource-card">
        <div class="resource-card-header">
          <div class="resource-title">${esc(r.title)}</div>
          <span class="badge b-${r.category}">${catMeta.label}</span>
        </div>
        <div class="resource-desc">${esc(r.description||'')}</div>
        ${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener" class="resource-url">&#128279; ${esc(r.url)}</a>` : ''}
        <div class="resource-footer">
          ${tags}
          <div class="resource-actions">
            <button class="btn-icon" onclick="openEditModal('resources','${r.id}')" title="수정">&#9998;</button>
            <button class="btn-icon" onclick="deleteItem('resources','${r.id}')" title="삭제">&#128465;</button>
          </div>
        </div>
      </div>`;
  }).join('');
}

// ──────────────────────────────────────────
// 사이드바
// ──────────────────────────────────────────
function updateSidebar() {
  document.getElementById('sb-news').textContent      = S.news.length;
  document.getElementById('sb-glossary').textContent  = S.glossary.length;
  document.getElementById('sb-notes').textContent     = S.notes.length;
  document.getElementById('sb-resources').textContent = S.resources.length;

  // 태그 클라우드
  const allTags = [
    ...S.news.flatMap(n => n.tags||[]),
    ...S.notes.flatMap(n => n.tags||[]),
    ...S.resources.flatMap(r => r.tags||[]),
  ];
  const tagCount = {};
  allTags.forEach(t => { tagCount[t] = (tagCount[t]||0) + 1; });
  const topTags = Object.entries(tagCount).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([t])=>t);
  document.getElementById('sb-tags').innerHTML = topTags.map(t =>
    `<span class="tag-chip" onclick="quickSearch('${esc(t)}')">${esc(t)}</span>`
  ).join('');

  // 카테고리 목록
  const curSection = S.section;
  let cats = {};
  if (curSection === 'news') {
    S.news.forEach(n => { cats[n.category] = (cats[n.category]||0) + 1; });
    document.getElementById('sb-cats').innerHTML = Object.entries(cats).map(([k,v]) => {
      const m = NEWS_CATS[k] || { label: k };
      return `<div class="cat-item" onclick="setCatFilter('news-cat-filter','${k}')">${m.label} <span class="cat-count">${v}</span></div>`;
    }).join('');
  } else if (curSection === 'resources') {
    S.resources.forEach(r => { cats[r.category] = (cats[r.category]||0) + 1; });
    document.getElementById('sb-cats').innerHTML = Object.entries(cats).map(([k,v]) => {
      const m = RESOURCE_CATS[k] || { label: k };
      return `<div class="cat-item" onclick="setCatFilter('resources-cat-filter','${k}')">${m.label} <span class="cat-count">${v}</span></div>`;
    }).join('');
  } else {
    document.getElementById('sb-cats').innerHTML = '';
  }
}

function quickSearch(tag) {
  const searchMap = { news:'news-search', notes:'notes-search', resources:'resources-search' };
  const inputId = searchMap[S.section] || 'news-search';
  const el = document.getElementById(inputId);
  if (el) { el.value = tag; el.dispatchEvent(new Event('input')); }
}
function setCatFilter(selectId, val) {
  const el = document.getElementById(selectId);
  if (el) { el.value = val; el.dispatchEvent(new Event('change')); }
}

// ──────────────────────────────────────────
// 추가/수정 모달
// ──────────────────────────────────────────
function openAddModal() {
  const map = {
    news: openNewsForm,
    glossary: openGlossaryForm,
    notes: openNoteForm,
    resources: openResourceForm,
  };
  (map[S.section] || openNewsForm)();
}

function openEditModal(type, id) {
  closeModal();
  setTimeout(() => {
    const item = S[type === 'glossary' ? 'glossary' : type === 'notes' ? 'notes' : type === 'resources' ? 'resources' : 'news'].find(x => x.id === id);
    if (!item) return;
    const map = { news: openNewsForm, glossary: openGlossaryForm, notes: openNoteForm, resources: openResourceForm };
    (map[type] || openNewsForm)(item);
  }, 150);
}

// 뉴스 폼
function openNewsForm(item = null) {
  const isEdit = !!item;
  openModal(isEdit ? '뉴스 수정' : '뉴스 스크랩 추가', `
    <div class="form-group">
      <label class="form-label">제목 *</label>
      <input class="form-input" id="f-title" value="${esc(item?.title||'')}" placeholder="뉴스 제목" />
    </div>
    <div class="form-group">
      <label class="form-label">요약 / 내용</label>
      <textarea class="form-textarea" id="f-summary" placeholder="뉴스 요약 또는 내용">${esc(item?.summary||'')}</textarea>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">카테고리</label>
        <select class="form-select" id="f-cat">
          ${Object.entries(NEWS_CATS).map(([k,v]) => `<option value="${k}" ${item?.category===k?'selected':''}>${v.label}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">심각도</label>
        <select class="form-select" id="f-sev">
          ${['critical','high','medium','low','info'].map(s => `<option value="${s}" ${item?.severity===s?'selected':''}>${s.toUpperCase()}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">출처</label>
        <input class="form-input" id="f-source" value="${esc(item?.source||'')}" placeholder="NVD, KISA, ..." />
      </div>
      <div class="form-group">
        <label class="form-label">날짜</label>
        <input class="form-input" type="date" id="f-date" value="${item?.date || today()}" />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">원문 URL</label>
      <input class="form-input" id="f-url" value="${esc(item?.url||'')}" placeholder="https://..." />
    </div>
    <div class="form-group">
      <label class="form-label">태그 (쉼표 구분)</label>
      <input class="form-input" id="f-tags" value="${(item?.tags||[]).join(', ')}" placeholder="태그1, 태그2, ..." />
      <span class="form-hint">예: CVE, 랜섬웨어, Log4j</span>
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="closeModal()">취소</button>
      <button class="btn btn-primary" onclick="saveNewsForm('${item?.id||''}')">저장</button>
    </div>
  `);
}

function saveNewsForm(editId) {
  const title = document.getElementById('f-title')?.value.trim();
  if (!title) { toast('제목을 입력하세요', 'error'); return; }
  const data = {
    id: editId || 'n' + Date.now(),
    title,
    summary: document.getElementById('f-summary')?.value.trim() || '',
    category: document.getElementById('f-cat')?.value || 'other',
    severity: document.getElementById('f-sev')?.value || 'info',
    source: document.getElementById('f-source')?.value.trim() || '',
    date: document.getElementById('f-date')?.value || today(),
    url: document.getElementById('f-url')?.value.trim() || '',
    tags: parseTags(document.getElementById('f-tags')?.value || ''),
  };
  if (editId) {
    const i = S.news.findIndex(x => x.id === editId);
    if (i >= 0) S.news[i] = data;
  } else {
    S.news.unshift(data);
  }
  saveStorage(); renderNews(); updateSidebar(); closeModal();
  toast(editId ? '뉴스 수정됨' : '뉴스 추가됨', 'success');
}

// 용어 폼
function openGlossaryForm(item = null) {
  const isEdit = !!item;
  openModal(isEdit ? '용어 수정' : '용어 추가', `
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">용어 (한글) *</label>
        <input class="form-input" id="f-term" value="${esc(item?.term||'')}" placeholder="예: 버퍼 오버플로우" />
      </div>
      <div class="form-group">
        <label class="form-label">영문명</label>
        <input class="form-input" id="f-eng" value="${esc(item?.eng||'')}" placeholder="Buffer Overflow" />
      </div>
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">카테고리</label>
        <select class="form-select" id="f-cat">
          ${Object.entries(GLOSSARY_CATS).map(([k,v]) => `<option value="${k}" ${item?.category===k?'selected':''}>${v.label}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">난이도</label>
        <select class="form-select" id="f-diff">
          <option value="beginner" ${item?.difficulty==='beginner'?'selected':''}>입문</option>
          <option value="intermediate" ${item?.difficulty==='intermediate'?'selected':''}>중급</option>
          <option value="advanced" ${item?.difficulty==='advanced'?'selected':''}>고급</option>
        </select>
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">정의 *</label>
      <textarea class="form-textarea" id="f-def" placeholder="용어에 대한 설명">${esc(item?.definition||'')}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label">예시 / 코드</label>
      <textarea class="form-textarea" id="f-ex" placeholder="예시 코드나 실제 사례">${esc(item?.example||'')}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label">관련 용어 (쉼표 구분)</label>
      <input class="form-input" id="f-related" value="${(item?.related||[]).join(', ')}" placeholder="SQL Injection, XSS, ..." />
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="closeModal()">취소</button>
      <button class="btn btn-primary" onclick="saveGlossaryForm('${item?.id||''}')">저장</button>
    </div>
  `);
}

function saveGlossaryForm(editId) {
  const term = document.getElementById('f-term')?.value.trim();
  const def  = document.getElementById('f-def')?.value.trim();
  if (!term || !def) { toast('용어와 정의를 입력하세요', 'error'); return; }
  const data = {
    id: editId || 'g' + Date.now(),
    term,
    eng:        document.getElementById('f-eng')?.value.trim() || '',
    category:   document.getElementById('f-cat')?.value || 'concept',
    difficulty: document.getElementById('f-diff')?.value || 'beginner',
    definition: def,
    example:    document.getElementById('f-ex')?.value.trim() || '',
    related:    parseTags(document.getElementById('f-related')?.value || ''),
  };
  if (editId) {
    const i = S.glossary.findIndex(x => x.id === editId);
    if (i >= 0) S.glossary[i] = data;
  } else {
    S.glossary.push(data);
  }
  saveStorage(); renderGlossary(); updateSidebar(); closeModal();
  toast(editId ? '용어 수정됨' : '용어 추가됨', 'success');
}

// 노트 폼
function openNoteForm(item = null) {
  const isEdit = !!item;
  openModal(isEdit ? '노트 수정' : '새 학습 노트', `
    <div class="form-group">
      <label class="form-label">제목 *</label>
      <input class="form-input" id="f-title" value="${esc(item?.title||'')}" placeholder="노트 제목" />
    </div>
    <div class="form-group">
      <label class="form-label">내용</label>
      <textarea class="form-textarea large" id="f-content" placeholder="공부한 내용, 정리, 메모 등을 자유롭게 작성하세요...">${esc(item?.content||'')}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label">태그 (쉼표 구분)</label>
      <input class="form-input" id="f-tags" value="${(item?.tags||[]).join(', ')}" placeholder="태그1, 태그2, ..." />
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="closeModal()">취소</button>
      <button class="btn btn-primary" onclick="saveNoteForm('${item?.id||''}')">저장</button>
    </div>
  `, 'modal-lg');
}

function saveNoteForm(editId) {
  const title = document.getElementById('f-title')?.value.trim();
  if (!title) { toast('제목을 입력하세요', 'error'); return; }
  const now = today();
  const data = {
    id: editId || 'note' + Date.now(),
    title,
    content: document.getElementById('f-content')?.value || '',
    tags:    parseTags(document.getElementById('f-tags')?.value || ''),
    date:    editId ? (S.notes.find(x=>x.id===editId)?.date || now) : now,
    updated: now,
  };
  if (editId) {
    const i = S.notes.findIndex(x => x.id === editId);
    if (i >= 0) S.notes[i] = data;
  } else {
    S.notes.unshift(data);
  }
  saveStorage(); renderNotes(); updateSidebar(); closeModal();
  toast(editId ? '노트 수정됨' : '노트 저장됨', 'success');
}

// 자료 폼
function openResourceForm(item = null) {
  const isEdit = !!item;
  openModal(isEdit ? '자료 수정' : '참고 자료 추가', `
    <div class="form-group">
      <label class="form-label">제목 *</label>
      <input class="form-input" id="f-title" value="${esc(item?.title||'')}" placeholder="자료 제목" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label class="form-label">카테고리</label>
        <select class="form-select" id="f-cat">
          ${Object.entries(RESOURCE_CATS).map(([k,v]) => `<option value="${k}" ${item?.category===k?'selected':''}>${v.label}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label class="form-label">URL</label>
        <input class="form-input" id="f-url" value="${esc(item?.url||'')}" placeholder="https://..." />
      </div>
    </div>
    <div class="form-group">
      <label class="form-label">설명</label>
      <textarea class="form-textarea" id="f-desc" placeholder="이 자료에 대한 설명, 추천 이유 등">${esc(item?.description||'')}</textarea>
    </div>
    <div class="form-group">
      <label class="form-label">태그 (쉼표 구분)</label>
      <input class="form-input" id="f-tags" value="${(item?.tags||[]).join(', ')}" placeholder="무료, 실습, 필수, ..." />
    </div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="closeModal()">취소</button>
      <button class="btn btn-primary" onclick="saveResourceForm('${item?.id||''}')">저장</button>
    </div>
  `);
}

function saveResourceForm(editId) {
  const title = document.getElementById('f-title')?.value.trim();
  if (!title) { toast('제목을 입력하세요', 'error'); return; }
  const data = {
    id: editId || 'r' + Date.now(),
    title,
    category:    document.getElementById('f-cat')?.value || 'docs',
    url:         document.getElementById('f-url')?.value.trim() || '',
    description: document.getElementById('f-desc')?.value.trim() || '',
    tags:        parseTags(document.getElementById('f-tags')?.value || ''),
    date:        today(),
  };
  if (editId) {
    const i = S.resources.findIndex(x => x.id === editId);
    if (i >= 0) S.resources[i] = data;
  } else {
    S.resources.unshift(data);
  }
  saveStorage(); renderResources(); updateSidebar(); closeModal();
  toast(editId ? '자료 수정됨' : '자료 추가됨', 'success');
}

// ──────────────────────────────────────────
// 삭제
// ──────────────────────────────────────────
function deleteItem(type, id) {
  if (!confirm('삭제하시겠습니까?')) return;
  S[type] = S[type].filter(x => x.id !== id);
  if (type === 'news') delete S.newsNotes[id];
  saveStorage();
  const renders = { news: renderNews, glossary: renderGlossary, notes: renderNotes, resources: renderResources };
  (renders[type] || (() => {}))();
  updateSidebar();
  closeModal();
  toast('삭제됨', 'info');
}

// ──────────────────────────────────────────
// n8n 모달
// ──────────────────────────────────────────
function openN8nModal() {
  openModal('n8n 뉴스 가져오기', `
    <p style="font-size:13px;color:var(--text2);line-height:1.7">
      n8n 워크플로우에서 뉴스 데이터를 JSON 배열로 붙여넣으세요.<br>
      또는 브라우저 콘솔에서 <code style="color:var(--accent)">loadFromN8n([...])</code> 를 호출하세요.
    </p>
    <div class="form-group">
      <label class="form-label">JSON 붙여넣기</label>
      <textarea class="form-textarea large" id="n8n-json" placeholder='[
  {
    "title": "뉴스 제목",
    "summary": "요약 내용",
    "category": "cve",
    "source": "출처",
    "url": "https://...",
    "date": "2026-02-23",
    "severity": "high",
    "tags": ["태그1", "태그2"]
  }
]'></textarea>
    </div>
    <div class="code-box">{
  "title":    "string (필수)",
  "summary":  "string",
  "category": "cve | vuln | breach | tools | policy | other",
  "severity": "critical | high | medium | low | info",
  "source":   "string",
  "url":      "string",
  "date":     "YYYY-MM-DD",
  "tags":     ["string"]
}</div>
    <div class="form-actions">
      <button class="btn btn-secondary" onclick="closeModal()">취소</button>
      <button class="btn btn-primary" onclick="importN8nJson()">가져오기</button>
    </div>
  `);
}

function importN8nJson() {
  const text = document.getElementById('n8n-json')?.value.trim();
  if (!text) return;
  try {
    const arr = JSON.parse(text);
    window.loadFromN8n(Array.isArray(arr) ? arr : [arr]);
    closeModal();
  } catch (e) {
    toast('JSON 형식 오류: ' + e.message, 'error');
  }
}

window.loadFromN8n = function(arr) {
  if (!Array.isArray(arr)) { toast('배열 형식이어야 합니다', 'error'); return; }
  let added = 0;
  arr.forEach(item => {
    if (!item.title) return;
    const n = {
      id: 'n8n' + Date.now() + Math.random().toString(36).slice(2,5),
      title: item.title, summary: item.summary||'',
      category: item.category||'other', severity: item.severity||'info',
      source: item.source||'n8n', url: item.url||'',
      date: item.date || today(),
      tags: Array.isArray(item.tags) ? item.tags : [],
    };
    if (!S.news.some(x => x.title === n.title && x.date === n.date)) {
      S.news.unshift(n); added++;
    }
  });
  saveStorage(); renderNews(); updateSidebar();
  toast(added ? `${added}개 뉴스 추가됨` : '새 뉴스 없음', added ? 'success' : 'info');
};

// ──────────────────────────────────────────
// 모달 헬퍼
// ──────────────────────────────────────────
function openModal(title, bodyHtml, extraClass = '') {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-body').innerHTML = bodyHtml;
  const box = document.getElementById('modal-box');
  box.className = 'modal' + (extraClass ? ' ' + extraClass : '');
  document.getElementById('modal-overlay').style.display = 'flex';
}
function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
}

// ──────────────────────────────────────────
// 유틸
// ──────────────────────────────────────────
function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function today() {
  return new Date().toISOString().slice(0,10);
}
function relDate(d) {
  if (!d) return '';
  try {
    const diff = Math.floor((Date.now() - new Date(d)) / 86400000);
    if (diff === 0) return '오늘';
    if (diff === 1) return '어제';
    if (diff < 7)  return diff + '일 전';
    return new Date(d).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric' });
  } catch { return d; }
}
function parseTags(s) {
  return s.split(',').map(t=>t.trim()).filter(Boolean);
}
function toast(msg, type = 'info') {
  document.querySelectorAll('.toast').forEach(e => e.remove());
  const t = document.createElement('div');
  t.className = 'toast ' + type;
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => { t.style.opacity='0'; t.style.transition='opacity .3s'; setTimeout(()=>t.remove(), 300); }, 2800);
}

// ──────────────────────────────────────────
// 실행
// ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
