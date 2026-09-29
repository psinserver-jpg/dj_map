/**
 * Busan Convenience Store Map - Application Controller (app.js)
 * Enhanced with:
 * 1. Current User Location (GPS) & Distance Sorting
 * 2. Store Favorites System (LocalStorage)
 * 3. Brand Specific Filtering & Statistics
 */

document.addEventListener('DOMContentLoaded', async () => {
  // 상태 변수
  let allStores = [];
  let filteredStores = [];
  let userCoords = null;

  // 즐겨찾기 저장소 (LocalStorage)
  const FAV_STORAGE_KEY = 'BUSAN_CS_FAVORITES_V2';
  let favorites = new Set();
  try {
    const saved = localStorage.getItem(FAV_STORAGE_KEY);
    if (saved) {
      favorites = new Set(JSON.parse(saved));
    }
  } catch (e) {
    console.warn('LocalStorage error:', e);
  }

  const state = {
    gu: 'all',
    brand: 'all',
    dong: 'all',
    radiusOn: false,
    radiusIdx: 5, // RADIUS_STEPS 인덱스 (기본 1km)
    sort: 'distance', // 'distance' | 'name' | 'brand' | 'region'
    groupBy: false, // 지역(구 또는 동)별로 묶어서 보기
    onlyFavorites: false,
    keyword: '',
    page: 1,
    pageSize: 40,
    bottomSheetState: 'collapsed' // 'collapsed', 'half', 'expanded'
  };

  // 반경 슬라이더 단계 (km)
  const RADIUS_STEPS = [0.1, 0.2, 0.3, 0.5, 0.7, 1, 1.5, 2, 3, 5, 7, 10];
  const BRAND_ORDER = ['CU', 'GS25', '세븐일레븐', '이마트24', '미니스톱', '씨스페이스', '기타'];
  const collator = new Intl.Collator('ko');

  // 데스크톱/모바일에 같은 컨트롤이 있으므로 클래스로 한 번에 다룸
  const elDongSelects = document.querySelectorAll('.dong-select');
  const elSortSelects = document.querySelectorAll('.sort-select');
  const elGroupToggles = document.querySelectorAll('.group-toggle');
  const elRadiusBoxes = document.querySelectorAll('.radius-box');
  const elRadiusRanges = document.querySelectorAll('.radius-range');
  const elRadiusToggles = document.querySelectorAll('.radius-toggle');
  const elRadiusLabels = document.querySelectorAll('.radius-label');
  const elOriginHints = document.querySelectorAll('.origin-hint');
  const elBtnBasemap = document.getElementById('btn-basemap');
  const elBasemapMenu = document.getElementById('basemap-menu');
  const elBasemapOpts = document.querySelectorAll('.basemap-opt');

  // DOM Elements
  const elGuSelect = document.getElementById('gu-select');
  const elSearchInput = document.getElementById('search-input');
  const elSearchClear = document.getElementById('search-clear');
  const elBrandChips = document.querySelectorAll('.brand-chip');
  const elStoreCount = document.getElementById('store-count');
  const elStoreList = document.getElementById('store-list');
  const elSortIndicator = document.getElementById('sort-indicator');

  // Buttons & Banners
  const elBtnReset = document.getElementById('btn-reset');
  const elBtnMyLocation = document.getElementById('btn-my-location');
  const elBtnResetView = document.getElementById('btn-reset-view');
  const elBtnGetLocation = document.getElementById('btn-get-location');
  const elLocationTitle = document.getElementById('location-title');
  const elLocationDesc = document.getElementById('location-desc');
  const elBtnFavFilter = document.getElementById('btn-fav-filter');
  const elFavCountBadge = document.getElementById('fav-count-badge');

  // Mobile Elements
  const elMobileBtnFav = document.getElementById('mobile-btn-fav');
  const elBottomSheet = document.getElementById('bottom-sheet');
  const elSheetHandle = document.getElementById('sheet-handle');
  const elSheetToggle = document.getElementById('sheet-toggle');
  const elSheetCount = document.getElementById('sheet-count');
  const elSheetSub = document.getElementById('sheet-sub');
  const elSheetList = document.getElementById('sheet-list');

  // 1. 지도 초기화
  MapController.init('map', {
    // 지도 우클릭 / 길게 누르기 → 그 위치를 기준점으로 거리 정렬
    onContextMenu: (latlng) => setOrigin({ lat: latlng.lat, lng: latlng.lng }, false)
  });

  // ==========================================
  // 즐겨찾기 글로벌 핸들러
  // ==========================================
  window.isStoreFavorite = function(storeId) {
    return favorites.has(storeId);
  };

  window.toggleFavorite = function(storeId, event) {
    if (event) {
      event.stopPropagation();
    }

    if (favorites.has(storeId)) {
      favorites.delete(storeId);
    } else {
      favorites.add(storeId);
    }

    // LocalStorage 저장
    try {
      localStorage.setItem(FAV_STORAGE_KEY, JSON.stringify([...favorites]));
    } catch (e) {
      console.warn('LocalStorage save error:', e);
    }

    // 즐겨찾기 배지 숫자 업데이트
    updateFavBadge();

    // 화면 내 버튼 아이콘 즉시 갱신
    updateFavIcons(storeId, favorites.has(storeId));

    // 즐겨찾기만 보기 모드일 때는 목록 재필터링
    if (state.onlyFavorites) {
      applyFilters();
    }
  };

  function updateFavBadge() {
    const count = favorites.size;
    if (elFavCountBadge) elFavCountBadge.textContent = count;
  }

  function updateFavIcons(storeId, isActive) {
    const btns = document.querySelectorAll(`[data-fav-id="${storeId}"]`);
    btns.forEach(btn => {
      btn.classList.toggle('is-active', isActive);
      btn.classList.toggle('text-[#FF9500]', isActive);
      btn.classList.toggle('text-[#c7c7cc]', !isActive);
      btn.title = isActive ? '즐겨찾기 해제' : '즐겨찾기 추가';

      // 쫀득한 별 바운스 애니메이션
      btn.classList.remove('is-bouncing');
      void btn.offsetWidth;
      btn.classList.add('is-bouncing');
      setTimeout(() => btn.classList.remove('is-bouncing'), 450);

      const svg = btn.querySelector('svg');
      if (svg) {
        if (isActive) {
          svg.setAttribute('class', 'w-5 h-5 fill-[#FF9500] stroke-[#FF9500]');
        } else {
          svg.setAttribute('class', 'w-5 h-5 fill-none stroke-current');
        }
      }
    });
  }

  // ==========================================
  // 데이터 로드
  // ==========================================
  async function loadData() {
    try {
      if (typeof STORES_DATA !== 'undefined' && Array.isArray(STORES_DATA) && STORES_DATA.length > 0) {
        allStores = STORES_DATA;
      } else {
        const res = await fetch('data/stores.json');
        allStores = await res.json();
      }
      console.log(`Successfully loaded ${allStores.length} stores.`);
      updateFavBadge();
      populateDongOptions();
      syncControls();
      
      // 초기 필터 적용 (우선 부산 전체)
      applyFilters(true);

      // 페이지 로드 시 현재 위치(GPS) 자동 감지 시도!
      requestUserLocation(true);
    } catch (err) {
      console.error('Failed to load store data:', err);
      if (elStoreList) {
        elStoreList.innerHTML = `
          <div class="p-6 text-center text-rose-500">
            <p class="font-bold">데이터를 불러오는 중 오류가 발생했습니다.</p>
            <p class="text-xs text-slate-500 mt-1">stores.json 또는 stores.js 파일을 확인해 주세요.</p>
          </div>
        `;
      }
    }
  }

  // ==========================================
  // 현재 위치 (GPS) 요청 핸들러
  // ==========================================
  function requestUserLocation(isAuto = false) {
    if (elLocationTitle) elLocationTitle.textContent = '현재 내 위치 찾는 중...';
    if (elBtnGetLocation) {
      elBtnGetLocation.textContent = '탐색 중...';
      elBtnGetLocation.classList.add('opacity-75');
    }

    MapController.locateUser(
      (coords) => {
        if (elBtnGetLocation) {
          elBtnGetLocation.textContent = '내 위치 재설정';
          elBtnGetLocation.classList.remove('opacity-75');
        }
        setOrigin(coords, true);
      },
      (errMsg) => {
        console.warn('Geolocation error:', errMsg);
        if (elLocationTitle) elLocationTitle.textContent = '📍 내 위치로 주변 편의점 찾기';
        if (elLocationDesc) elLocationDesc.textContent = '클릭 시 현재 위치 주변 편의점을 자동 정렬합니다';
        if (elBtnGetLocation) {
          elBtnGetLocation.textContent = '내 위치 켜기';
          elBtnGetLocation.classList.remove('opacity-75');
        }

        // 자동 시도가 아닌 사용자가 직접 클릭했을 때만 alert 알림
        if (!isAuto) {
          alert(errMsg);
        }
      }
    );
  }

  // 기준점 설정 (GPS 또는 지도에서 지정)
  function setOrigin(coords, isGps) {
    userCoords = { lat: coords.lat, lng: coords.lng };
    if (!isGps) MapController.setOrigin(coords.lat, coords.lng, { isGps: false });

    if (elLocationTitle) elLocationTitle.textContent = isGps ? '📍 내 현재 위치 기준 탐색 중' : '📌 지도에서 지정한 위치 기준';
    if (elLocationDesc) elLocationDesc.textContent = '다른 곳을 우클릭(길게 누르기)하면 기준점 변경';
    elOriginHints.forEach(el => el.classList.add('hidden'));
    elRadiusBoxes.forEach(el => el.classList.remove('hidden'));

    // 기준점이 생기면 가까운 순 정렬로 전환
    state.sort = 'distance';
    syncControls();
    applyFilters(false);
  }

  function currentRadiusKm() {
    return state.radiusOn ? RADIUS_STEPS[state.radiusIdx] : null;
  }

  // 구 선택에 맞춰 행정동 옵션 채우기
  function populateDongOptions() {
    elDongSelects.forEach(sel => {
      if (state.gu === 'all') {
        sel.innerHTML = `<option value="all">${sel.dataset.placeholder || '구·군을 먼저 선택하세요'}</option>`;
        sel.disabled = true;
        return;
      }
      const counts = {};
      allStores.forEach(s => {
        if (s.gu === state.gu && s.dong) counts[s.dong] = (counts[s.dong] || 0) + 1;
      });
      const dongs = Object.keys(counts).sort(collator.compare);
      sel.innerHTML = `<option value="all">${state.gu} 전체 동 (${dongs.length}개)</option>` +
        dongs.map(d => `<option value="${d}">${d} (${counts[d]}개)</option>`).join('');
      sel.disabled = false;
      sel.value = state.dong;
    });
  }

  // 여러 곳에 있는 동일 컨트롤들의 표시 상태 동기화
  function syncControls() {
    elSortSelects.forEach(sel => {
      sel.value = state.sort;
      const distOpt = sel.querySelector('option[value="distance"]');
      if (distOpt) {
        distOpt.disabled = !userCoords;
        distOpt.textContent = userCoords ? '📍 가까운 순' : '📍 가까운 순 (위치 필요)';
      }
      if (!userCoords && state.sort === 'distance') sel.value = 'name';
    });
    elGroupToggles.forEach(btn => {
      btn.classList.toggle('bg-[#007AFF]', state.groupBy);
      btn.classList.toggle('text-white', state.groupBy);
      btn.classList.toggle('border-[#007AFF]', state.groupBy);
      btn.classList.toggle('bg-white/50', !state.groupBy);
      btn.classList.toggle('text-[#636366]', !state.groupBy);
    });
    const km = RADIUS_STEPS[state.radiusIdx];
    const label = km < 1 ? `${Math.round(km * 1000)}m` : `${km}km`;
    elRadiusRanges.forEach(r => { r.value = state.radiusIdx; r.disabled = !state.radiusOn; });
    elRadiusToggles.forEach(t => { t.checked = state.radiusOn; });
    elRadiusLabels.forEach(l => {
      l.textContent = label;
      l.classList.toggle('opacity-50', !state.radiusOn);
    });
  }

  // 두 좌표 간 거리 계산 (km)
  function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  function formatDistance(distKm) {
    if (distKm === undefined || isNaN(distKm)) return '';
    if (distKm < 1) {
      return `${Math.round(distKm * 1000)}m`;
    }
    return `${distKm.toFixed(1)}km`;
  }

  // ==========================================
  // 필터링 엔진
  // ==========================================
  function applyFilters(fitBounds = false) {
    const kw = state.keyword.trim().toLowerCase().replace(/\s+/g, '');

    // 모든 점포에 대해 내 위치와의 거리 미리 계산
    if (userCoords) {
      allStores.forEach(s => {
        s.distance = calculateDistance(userCoords.lat, userCoords.lng, s.lat, s.lng);
      });
    }

    const maxDist = userCoords ? currentRadiusKm() : null;

    filteredStores = allStores.filter(store => {
      // 1. 즐겨찾기 필터
      if (state.onlyFavorites && !favorites.has(store.id)) {
        return false;
      }

      // 2. 구 필터
      if (state.gu !== 'all' && store.gu !== state.gu) {
        return false;
      }

      // 3. 브랜드 필터 (편의점별 확인)
      if (state.brand !== 'all') {
        if (state.brand === '기타') {
          if (['CU', 'GS25', '세븐일레븐', '이마트24', '미니스톱', '씨스페이스'].includes(store.brand)) {
            return false;
          }
        } else if (store.brand !== state.brand) {
          return false;
        }
      }

      // 2-1. 행정동 필터
      if (state.gu !== 'all' && state.dong !== 'all' && store.dong !== state.dong) {
        return false;
      }

      // 4. 반경 필터 (기준점 기준)
      if (userCoords && maxDist !== null && store.distance > maxDist) {
        return false;
      }

      // 5. 키워드 필터 (상호명, 지점명, 도로명, 지번주소)
      if (kw) {
        const fullText = (
          (store.name || '') +
          (store.branch || '') +
          (store.road_addr || '') +
          (store.jibun_addr || '') +
          (store.dong || '')
        ).toLowerCase().replace(/\s+/g, '');

        if (!fullText.includes(kw)) {
          return false;
        }
      }

      return true;
    });

    sortStores(filteredStores);

    // 반경 원 표시
    MapController.setRadiusCircle(userCoords, maxDist);

    state.page = 1;

    // 카운터 갱신
    updateCounters(filteredStores.length);

    // 마커 업데이트
    MapController.updateMarkers(filteredStores, fitBounds);

    // 점포 목록 렌더링
    renderStoreList(filteredStores);
  }

  // 정렬 (+ 지역별 묶기 시 그룹 단위로 먼저 정렬)
  function groupKeyOf(store) {
    return state.gu === 'all' ? (store.gu || '기타') : (store.dong || '기타');
  }

  function sortStores(list) {
    const sortKey = (state.sort === 'distance' && !userCoords) ? 'name' : state.sort;
    const byName = (a, b) => collator.compare(`${a.name}${a.branch || ''}`, `${b.name}${b.branch || ''}`);
    const brandIdx = (s) => {
      const i = BRAND_ORDER.indexOf(s.brand);
      return i === -1 ? BRAND_ORDER.length - 1 : i;
    };
    const cmp = {
      distance: (a, b) => a.distance - b.distance,
      name: byName,
      brand: (a, b) => (brandIdx(a) - brandIdx(b)) || byName(a, b),
      region: (a, b) => collator.compare(a.gu || '', b.gu || '') || collator.compare(a.dong || '', b.dong || '') || byName(a, b)
    }[sortKey];

    if (!state.groupBy) {
      list.sort(cmp);
    } else {
      // 그룹 순서: 가까운 순이면 그룹 내 최단거리 기준, 아니면 지역명 가나다
      const groupRank = {};
      if (sortKey === 'distance') {
        list.forEach(s => {
          const k = groupKeyOf(s);
          groupRank[k] = Math.min(groupRank[k] ?? Infinity, s.distance);
        });
      }
      const cmpGroup = sortKey === 'distance'
        ? (a, b) => groupRank[a] - groupRank[b]
        : (a, b) => collator.compare(a, b);
      list.sort((a, b) => cmpGroup(groupKeyOf(a), groupKeyOf(b)) || cmp(a, b));
    }

    const sortLabel = {
      distance: '📍 가까운 순', name: '가나다 순', brand: '브랜드 순', region: '지역 순'
    }[sortKey];
    if (elSheetSub) elSheetSub.textContent = sortLabel + (state.groupBy ? ' · 지역별' : '');
  }

  // 카운터 업데이트
  function updateCounters(count) {
    let text = `총 ${count.toLocaleString()}개 점포`;
    if (state.onlyFavorites) {
      text = `⭐ 즐겨찾기 ${count.toLocaleString()}개 점포`;
    }
    if (elStoreCount) elStoreCount.textContent = text;
    if (elSheetCount) elSheetCount.textContent = text;
  }

  // ==========================================
  // 점포 카드 템플릿 생성 (Apple Card Style + Spring Motion)
  // ==========================================
  function createStoreCardHTML(store, index = 0) {
    const brand = store.brand || '기타';
    const config = MapController.BRAND_CONFIG[brand] || MapController.BRAND_CONFIG['기타'];
    const branchText = store.branch ? `(${store.branch})` : '';
    const distText = store.distance !== undefined ? formatDistance(store.distance) : '';
    const isFav = favorites.has(store.id);
    const delaySec = Math.min(index * 0.03, 0.42).toFixed(3);

    return `
      <div class="store-card apple-store-card apple-card-animated group relative p-4 rounded-2xl cursor-pointer"
           style="animation-delay: ${delaySec}s;"
           data-id="${store.id}">
        <div class="flex items-start justify-between gap-2 mb-2 pr-7">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="px-2.5 py-0.5 text-[11px] font-bold rounded-full ${config.badgeClass} shadow-2xs">
              ${brand}
            </span>
            <span class="text-xs text-[#8e8e93] font-medium">${store.gu} ${store.dong || ''}</span>
          </div>
          ${distText ? `
            <span class="text-xs font-bold text-[#007AFF] bg-[#007AFF]/12 px-2.5 py-0.5 rounded-full shrink-0">
              📍 ${distText}
            </span>
          ` : ''}
        </div>

        <!-- ⭐ 즐겨찾기 버튼 (카드 우측 상단) -->
        <button class="fav-btn absolute top-3.5 right-3.5 p-1 text-[#c7c7cc] hover:text-[#FF9500] ${isFav ? 'is-active text-[#FF9500]' : ''}" 
                data-fav-id="${store.id}"
                title="${isFav ? '즐겨찾기 해제' : '즐겨찾기 추가'}"
                onclick="window.toggleFavorite('${store.id}', event)">
          <svg class="w-5 h-5 ${isFav ? 'fill-[#FF9500] stroke-[#FF9500]' : 'fill-none stroke-current'}" viewBox="0 0 24 24" stroke-width="2">
            <path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
          </svg>
        </button>

        <h4 class="text-[15px] font-bold text-[#1c1c1e] group-hover:text-[#007AFF] transition-colors leading-snug tracking-tight">
          ${store.name} <span class="text-xs font-semibold text-[#8e8e93]">${branchText}</span>
        </h4>

        <p class="text-xs text-[#8e8e93] mt-1.5 truncate leading-relaxed">
          ${store.road_addr || store.jibun_addr || '주소 정보 없음'}
        </p>
      </div>
    `;
  }

  // ==========================================
  // 점포 목록 렌더링
  // ==========================================
  function renderStoreList(stores) {
    const displayStores = stores.slice(0, state.page * state.pageSize);
    const hasMore = stores.length > displayStores.length;

    let html = '';
    if (displayStores.length === 0) {
      html = `
        <div class="p-8 text-center text-[#8e8e93]">
          <svg class="w-12 h-12 mx-auto mb-2 text-[#c7c7cc] stroke-current fill-none" viewBox="0 0 24 24" stroke-width="1.5">
            <circle cx="11" cy="11" r="8"></circle>
            <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
          </svg>
          <p class="text-sm font-medium">검색 결과가 없습니다.</p>
          <p class="text-xs text-[#8e8e93] mt-1">
            ${state.onlyFavorites ? '즐겨찾기한 편의점이 없습니다. 별(⭐)을 눌러 추가해 보세요!' : '필터 조건이나 검색어를 변경해 보세요.'}
          </p>
        </div>
      `;
    } else {
      if (state.groupBy) {
        const groupCounts = {};
        stores.forEach(s => {
          const k = groupKeyOf(s);
          groupCounts[k] = (groupCounts[k] || 0) + 1;
        });
        let prevKey = null;
        html = displayStores.map((store, idx) => {
          const k = groupKeyOf(store);
          let header = '';
          if (k !== prevKey) {
            prevKey = k;
            header = `
              <div class="sticky top-0 z-10 -mx-1 px-2 py-1.5 mt-1 flex items-center justify-between rounded-xl apple-glass-subtle">
                <span class="text-xs font-bold text-[#1c1c1e]">📍 ${k}</span>
                <span class="text-[11px] font-semibold text-[#8e8e93]">${groupCounts[k].toLocaleString()}개</span>
              </div>`;
          }
          return header + createStoreCardHTML(store, idx);
        }).join('');
      } else {
        html = displayStores.map((store, idx) => createStoreCardHTML(store, idx)).join('');
      }
      if (hasMore) {
        html += `
          <div class="p-3 text-center">
            <button id="btn-load-more" class="apple-pressable w-full py-2.5 bg-white/50 hover:bg-white/80 text-[#007AFF] text-xs font-bold rounded-2xl transition shadow-2xs border border-white/60">
              더 보기 (${displayStores.length} / ${stores.length})
            </button>
          </div>
        `;
      }
    }

    if (elStoreList) elStoreList.innerHTML = html;
    if (elSheetList) elSheetList.innerHTML = html;

    // 더 보기 버튼 이벤트
    document.querySelectorAll('#btn-load-more').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.page += 1;
        renderStoreList(filteredStores);
      });
    });

    // 카드 클릭 이벤트 바인딩
    attachCardClickEvents();
  }

  // 카드 클릭 이벤트
  function attachCardClickEvents() {
    const cards = document.querySelectorAll('.store-card');
    cards.forEach(card => {
      card.addEventListener('click', (e) => {
        // 별 버튼 클릭인 경우 무시
        if (e.target.closest('.fav-btn')) return;

        const id = card.getAttribute('data-id');
        const store = allStores.find(s => s.id === id);
        if (store) {
          MapController.focusStore(store);

          // 모바일 화면에서는 지도가 보이도록 바텀시트를 살짝 접음
          if (window.innerWidth < 768) {
            setBottomSheetState('collapsed');
          }
        }
      });
    });
  }

  // ==========================================
  // 모바일 바텀시트 제어
  // ==========================================
  function setBottomSheetState(newState) {
    state.bottomSheetState = newState;
    if (!elBottomSheet) return;

    elBottomSheet.classList.remove('state-collapsed', 'state-half', 'state-expanded');
    elBottomSheet.classList.add(`state-${newState}`);
    document.body.dataset.sheet = newState;

    if (elSheetToggle) {
      if (newState === 'expanded') {
        elSheetToggle.innerHTML = `
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
          </svg>
        `;
      } else {
        elSheetToggle.innerHTML = `
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 15l7-7 7 7" />
          </svg>
        `;
      }
    }
  }

  if (elSheetHandle) {
    elSheetHandle.addEventListener('click', () => {
      if (state.bottomSheetState === 'collapsed') {
        setBottomSheetState('half');
      } else if (state.bottomSheetState === 'half') {
        setBottomSheetState('expanded');
      } else {
        setBottomSheetState('collapsed');
      }
    });
  }

  if (elSheetToggle) {
    elSheetToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      if (state.bottomSheetState === 'collapsed') {
        setBottomSheetState('half');
      } else if (state.bottomSheetState === 'half') {
        setBottomSheetState('expanded');
      } else {
        setBottomSheetState('collapsed');
      }
    });
  }

  // ==========================================
  // 이벤트 리스너 바인딩
  // ==========================================

  // 즐겨찾기 전용 필터 토글
  function toggleFavFilter() {
    state.onlyFavorites = !state.onlyFavorites;
    const isActive = state.onlyFavorites;

    if (elBtnFavFilter) {
      elBtnFavFilter.classList.toggle('bg-amber-500', isActive);
      elBtnFavFilter.classList.toggle('text-white', isActive);
      elBtnFavFilter.classList.toggle('border-amber-500', isActive);
      elBtnFavFilter.classList.toggle('bg-white', !isActive);
      elBtnFavFilter.classList.toggle('text-slate-700', !isActive);
      elBtnFavFilter.classList.toggle('border-slate-300', !isActive);
      const svg = elBtnFavFilter.querySelector('svg');
      if (svg) {
        svg.setAttribute('class', isActive ? 'w-4 h-4 text-white fill-white' : 'w-4 h-4 text-amber-500 fill-amber-400 stroke-amber-500');
      }
    }

    if (elMobileBtnFav) {
      elMobileBtnFav.classList.toggle('bg-amber-500', isActive);
      elMobileBtnFav.classList.toggle('text-white', isActive);
      elMobileBtnFav.classList.toggle('bg-amber-50', !isActive);
      elMobileBtnFav.classList.toggle('text-amber-500', !isActive);
    }

    applyFilters(true);
  }

  if (elBtnFavFilter) elBtnFavFilter.addEventListener('click', toggleFavFilter);
  if (elMobileBtnFav) elMobileBtnFav.addEventListener('click', toggleFavFilter);

  // 구/군 셀렉트
  if (elGuSelect) {
    elGuSelect.addEventListener('change', (e) => {
      state.gu = e.target.value;
      state.dong = 'all';
      populateDongOptions();
      applyFilters();
      MapController.focusGu(state.gu);
    });
  }

  // 브랜드 칩 클릭 (편의점별 필터)
  elBrandChips.forEach(chip => {
    chip.addEventListener('click', () => {
      const selectedBrand = chip.getAttribute('data-brand');
      state.brand = selectedBrand;

      elBrandChips.forEach(c => {
        const isMatch = c.getAttribute('data-brand') === selectedBrand;
        c.classList.toggle('bg-[#007AFF]', isMatch);
        c.classList.toggle('text-white', isMatch);
        c.classList.toggle('shadow-sm', isMatch);
        c.classList.toggle('bg-white', !isMatch);
        c.classList.toggle('text-[#1c1c1e]', !isMatch);
        c.classList.toggle('border-black/[0.06]', !isMatch);
      });

      applyFilters();
    });
  });

  // 행정동 셀렉트
  elDongSelects.forEach(sel => {
    sel.addEventListener('change', (e) => {
      state.dong = e.target.value;
      elDongSelects.forEach(o => { o.value = state.dong; });
      applyFilters(true);
    });
  });

  // 정렬 셀렉트
  elSortSelects.forEach(sel => {
    sel.addEventListener('change', (e) => {
      state.sort = e.target.value;
      syncControls();
      applyFilters();
    });
  });

  // 지역별 묶기 토글
  elGroupToggles.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      state.groupBy = !state.groupBy;
      syncControls();
      applyFilters();
    });
  });

  // 반경 제한 on/off
  elRadiusToggles.forEach(t => {
    t.addEventListener('change', (e) => {
      state.radiusOn = e.target.checked;
      syncControls();
      applyFilters();
      if (state.radiusOn) MapController.setRadiusCircle(userCoords, currentRadiusKm(), true);
    });
  });

  // 반경 슬라이더 (드래그 중에는 원만 갱신, 놓으면 필터 적용)
  elRadiusRanges.forEach(r => {
    r.addEventListener('input', (e) => {
      state.radiusIdx = parseInt(e.target.value, 10);
      syncControls();
      MapController.setRadiusCircle(userCoords, currentRadiusKm());
    });
    r.addEventListener('change', () => {
      applyFilters();
      MapController.setRadiusCircle(userCoords, currentRadiusKm(), true);
    });
  });

  // 지도 스타일 (일반/위성) 메뉴
  function syncBasemapMenu() {
    const cur = MapController.getBaseLayer();
    elBasemapOpts.forEach(o => {
      const on = o.getAttribute('data-base') === cur;
      o.classList.toggle('bg-[#007AFF]', on);
      o.classList.toggle('text-white', on);
      o.classList.toggle('text-[#1c1c1e]', !on);
      o.classList.toggle('hover:bg-white/70', !on);
    });
  }
  if (elBtnBasemap && elBasemapMenu) {
    elBtnBasemap.addEventListener('click', (e) => {
      e.stopPropagation();
      syncBasemapMenu();
      elBasemapMenu.classList.toggle('hidden');
    });
    elBasemapOpts.forEach(o => {
      o.addEventListener('click', (e) => {
        e.stopPropagation();
        MapController.setBaseLayer(o.getAttribute('data-base'));
        syncBasemapMenu();
        elBasemapMenu.classList.add('hidden');
      });
    });
    document.addEventListener('click', () => elBasemapMenu.classList.add('hidden'));
  }

  // 키워드 검색 입력 (디바운스 200ms)
  let debounceTimeout = null;
  if (elSearchInput) {
    elSearchInput.addEventListener('input', (e) => {
      clearTimeout(debounceTimeout);
      const val = e.target.value;
      if (elSearchClear) {
        elSearchClear.classList.toggle('hidden', val.length === 0);
      }
      debounceTimeout = setTimeout(() => {
        state.keyword = val;
        applyFilters();
      }, 200);
    });
  }

  // 검색어 삭제 버튼
  if (elSearchClear) {
    elSearchClear.addEventListener('click', () => {
      elSearchInput.value = '';
      state.keyword = '';
      elSearchClear.classList.add('hidden');
      applyFilters();
      elSearchInput.focus();
    });
  }

  // 전체 초기화 버튼
  if (elBtnReset) {
    elBtnReset.addEventListener('click', () => {
      state.gu = 'all';
      state.brand = 'all';
      state.dong = 'all';
      state.radiusOn = false;
      state.groupBy = false;
      state.onlyFavorites = false;
      state.keyword = '';

      if (elGuSelect) elGuSelect.value = 'all';
      if (elSearchInput) elSearchInput.value = '';
      if (elSearchClear) elSearchClear.classList.add('hidden');

      if (elBtnFavFilter) {
        elBtnFavFilter.classList.remove('bg-[#FF9500]', 'text-white', 'border-[#FF9500]');
        elBtnFavFilter.classList.add('bg-white', 'text-[#1c1c1e]', 'border-black/[0.08]');
      }

      elBrandChips.forEach(c => {
        const isAll = c.getAttribute('data-brand') === 'all';
        c.classList.toggle('bg-[#007AFF]', isAll);
        c.classList.toggle('text-white', isAll);
        c.classList.toggle('shadow-sm', isAll);
        c.classList.toggle('bg-white', !isAll);
        c.classList.toggle('text-[#1c1c1e]', !isAll);
      });

      if (userCoords) state.sort = 'distance';
      populateDongOptions();
      syncControls();

      MapController.resetView();
      applyFilters();
    });
  }

  // 내 위치 버튼 (배너 내 버튼)
  if (elBtnGetLocation) {
    elBtnGetLocation.addEventListener('click', () => {
      requestUserLocation(false);
    });
  }

  // 내 위치 버튼 (우측 하단 FAB)
  if (elBtnMyLocation) {
    elBtnMyLocation.addEventListener('click', () => {
      elBtnMyLocation.classList.add('animate-pulse');
      requestUserLocation(false);
      setTimeout(() => elBtnMyLocation.classList.remove('animate-pulse'), 1500);
    });
  }

  // 부산 전체보기 리셋 버튼
  if (elBtnResetView) {
    elBtnResetView.addEventListener('click', () => {
      MapController.resetView();
    });
  }

  // 데이터 로드 실행
  loadData();
});
