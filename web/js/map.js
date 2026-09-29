/**
 * Busan Convenience Store Map - Map Controller (map.js)
 * Powered by Leaflet.js and OpenStreetMap (100% Free)
 */

const MapController = (() => {
  let map = null;
  let clusterGroup = null;
  let userMarker = null;
  let userCircle = null;
  const storeMarkerMap = new Map();

  // 부산 16개 구/군 중심 좌표
  const GU_CENTERS = {
    '강서구': { lat: 35.12530, lng: 128.90317, zoom: 12 },
    '금정구': { lat: 35.24412, lng: 129.09205, zoom: 13 },
    '기장군': { lat: 35.27811, lng: 129.21237, zoom: 12 },
    '남구': { lat: 35.13063, lng: 129.09499, zoom: 13 },
    '동구': { lat: 35.12527, lng: 129.04705, zoom: 14 },
    '동래구': { lat: 35.20475, lng: 129.08117, zoom: 13 },
    '부산진구': { lat: 35.15925, lng: 129.05209, zoom: 13 },
    '북구': { lat: 35.21754, lng: 129.01284, zoom: 13 },
    '사상구': { lat: 35.16097, lng: 128.98866, zoom: 13 },
    '사하구': { lat: 35.08781, lng: 128.97525, zoom: 13 },
    '서구': { lat: 35.09861, lng: 129.01824, zoom: 14 },
    '수영구': { lat: 35.16003, lng: 129.11546, zoom: 14 },
    '연제구': { lat: 35.18514, lng: 129.08402, zoom: 14 },
    '영도구': { lat: 35.08351, lng: 129.05819, zoom: 13 },
    '중구': { lat: 35.10295, lng: 129.03152, zoom: 14 },
    '해운대구': { lat: 35.17778, lng: 129.15414, zoom: 13 }
  };

  // Apple HIG 스타일 브랜드 색상 및 약어 정의
  const BRAND_CONFIG = {
    'CU': { color: '#7B2CBF', text: 'CU', badgeClass: 'badge-cu' },
    'GS25': { color: '#007AFF', text: 'GS', badgeClass: 'badge-gs25' },
    '세븐일레븐': { color: '#34C759', text: '7', badgeClass: 'badge-seven' },
    '이마트24': { color: '#FF9500', text: '24', badgeClass: 'badge-emart24' },
    '미니스톱': { color: '#004085', text: 'M', badgeClass: 'badge-ministop' },
    '씨스페이스': { color: '#FF3B30', text: 'C', badgeClass: 'badge-cspace' },
    '기타': { color: '#8E8E93', text: '편', badgeClass: 'badge-etc' }
  };

  // Apple Maps 스타일 SVG 마커 핀 생성
  function createCustomIcon(brand) {
    const config = BRAND_CONFIG[brand] || BRAND_CONFIG['기타'];
    const svgHtml = `
      <div class="apple-pin">
        <svg class="apple-pin-svg" viewBox="0 0 32 38" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M16 0C7.16344 0 0 7.16344 0 16C0 25.5 13.5 36.8 15.2 37.8C15.7 38.1 16.3 38.1 16.8 37.8C18.5 36.8 32 25.5 32 16C32 7.16344 24.8366 0 16 0Z" fill="${config.color}"/>
          <circle cx="16" cy="15" r="13" fill="white" fill-opacity="0.22"/>
          <circle cx="16" cy="15" r="14.5" stroke="white" stroke-width="1.2" stroke-opacity="0.5"/>
        </svg>
        <span class="apple-pin-label">${config.text}</span>
      </div>
    `;

    return L.divIcon({
      html: svgHtml,
      className: '',
      iconSize: [32, 38],
      iconAnchor: [16, 38],
      popupAnchor: [0, -36]
    });
  }

  // 팝업 HTML 생성
  function createPopupHTML(store) {
    const brand = store.brand || '기타';
    const config = BRAND_CONFIG[brand] || BRAND_CONFIG['기타'];
    const displayName = store.name || '편의점';
    const displayBranch = store.branch ? `(${store.branch})` : '';
    const isFav = typeof window.isStoreFavorite === 'function' ? window.isStoreFavorite(store.id) : false;
    
    // 길찾기 URL 인코딩
    const encodedName = encodeURIComponent(`${displayName} ${displayBranch}`.trim());
    const encodedAddr = encodeURIComponent(store.road_addr || store.jibun_addr || '');
    const naverMapUrl = `https://map.naver.com/p/search/${encodedAddr || encodedName}`;
    const kakaoMapUrl = `https://map.kakao.com/link/to/${encodedName},${store.lat},${store.lng}`;

    let distHtml = '';
    if (store.distance !== undefined) {
      const dStr = store.distance < 1 ? `${Math.round(store.distance * 1000)}m` : `${store.distance.toFixed(1)}km`;
      distHtml = `<span class="px-2 py-0.5 text-[11px] font-bold text-[#007AFF] bg-[#007AFF]/10 rounded-full">📍 ${dStr}</span>`;
    }

    return `
      <div class="p-4 font-sans text-[#1c1c1e]">
        <div class="flex items-center justify-between gap-2 mb-2 pr-6">
          <div class="flex items-center gap-1.5 flex-wrap">
            <span class="px-2.5 py-0.5 text-[11px] font-bold rounded-full ${config.badgeClass} shadow-2xs">
              ${brand}
            </span>
            <span class="text-xs text-[#8e8e93] font-medium">${store.gu} ${store.dong || ''}</span>
          </div>
          ${distHtml}
        </div>
        
        <div class="flex items-start justify-between gap-2 mb-1.5">
          <h3 class="text-[15px] font-bold text-[#1c1c1e] leading-snug tracking-tight">
            ${displayName} <span class="text-xs font-semibold text-[#007AFF]">${displayBranch}</span>
          </h3>
          <button onclick="window.toggleFavorite('${store.id}', event)" 
                  class="fav-btn p-1 text-[#c7c7cc] hover:text-[#FF9500] ${isFav ? 'is-active text-[#FF9500]' : ''} shrink-0" 
                  title="${isFav ? '즐겨찾기 해제' : '즐겨찾기 추가'}"
                  data-fav-id="${store.id}">
            <svg class="w-5 h-5 ${isFav ? 'fill-[#FF9500] stroke-[#FF9500]' : 'fill-none stroke-current'}" viewBox="0 0 24 24" stroke-width="2">
              <path stroke-linecap="round" stroke-linejoin="round" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"/>
            </svg>
          </button>
        </div>

        <div class="mt-2.5 pt-2.5 border-t border-black/[0.06] text-xs text-[#636366] space-y-1.5">
          <div class="flex items-start gap-2">
            <span class="font-medium text-[#8e8e93] shrink-0 text-[11px]">도로명</span>
            <span class="text-[#1c1c1e] select-all leading-relaxed">${store.road_addr || '정보 없음'}</span>
          </div>
          ${store.jibun_addr ? `
          <div class="flex items-start gap-2">
            <span class="font-medium text-[#8e8e93] shrink-0 text-[11px]">지번</span>
            <span class="text-[#8e8e93] leading-relaxed">${store.jibun_addr}</span>
          </div>` : ''}
        </div>

        <div class="mt-3.5 pt-2.5 border-t border-black/[0.06] grid grid-cols-2 gap-2">
          <a href="${naverMapUrl}" target="_blank" rel="noopener noreferrer" 
             class="flex items-center justify-center gap-1.5 py-2 px-2.5 bg-[#34C759]/10 hover:bg-[#34C759]/20 text-[#28a745] text-xs font-bold rounded-xl transition active:scale-95">
            <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M16.273 12.845 7.376 0H0v24h7.727V11.155L16.624 24H24V0h-7.727v12.845z"/></svg>
            네이버 길찾기
          </a>
          <a href="${kakaoMapUrl}" target="_blank" rel="noopener noreferrer" 
             class="flex items-center justify-center gap-1.5 py-2 px-2.5 bg-[#FFCC00]/20 hover:bg-[#FFCC00]/30 text-[#8F6B00] text-xs font-bold rounded-xl transition active:scale-95">
            <svg class="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M12 3c-5.52 0-10 3.58-10 8 0 2.82 1.86 5.3 4.67 6.7l-1.18 4.34c-.1.37.28.69.61.5l5.16-3.41c.24.02.49.03.74.03 5.52 0 10-3.58 10-8s-4.48-8-10-8z"/></svg>
            카카오 길찾기
          </a>
        </div>
      </div>
    `;
  }

  // 초기화
  function init(containerId = 'map') {
    // 부산 중심 좌표 (부산시청 인근)
    const BUSAN_CENTER = [35.1796, 129.0756];

    map = L.map(containerId, {
      center: BUSAN_CENTER,
      zoom: 11,
      minZoom: 9,
      maxZoom: 18,
      zoomControl: false // 커스텀 위치로 추가
    });

    // 줌 컨트롤 우측 상단 배치
    L.control.zoom({ position: 'topright' }).addTo(map);

    // 100% 무료 & 워터마크 없는 글로벌 타일 레이어 설정
    // 1. 기본 거리 지도 (OSM DE: 403 없음, 전 세계 데이터, 고줌 완벽 지원)
    const osmDeTile = L.tileLayer('https://tile.openstreetmap.de/{z}/{x}/{y}.png', {
      maxZoom: 20,
      maxNativeZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank">OpenStreetMap</a> contributors'
    });

    // 2. 고해상도 위성 하이브리드 (위성 사진 + 도로명/지명 라벨)
    const hybridTile = L.layerGroup([
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 20,
        maxNativeZoom: 19
      }),
      L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}', {
        maxZoom: 20,
        maxNativeZoom: 19,
        attribution: 'Labels &copy; Esri'
      })
    ]);

    // 3. 순수 위성 사진 (Esri World Imagery)
    const satelliteTile = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 20,
      maxNativeZoom: 19,
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics'
    });

    // 4. Esri 거리 지도 (한국어 지명, 일부 지역 제한 있음)
    const esriStreetTile = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 20,
      maxNativeZoom: 19,
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, NAVTEQ'
    });

    // 5. 지형/지세 지도 (Esri World Topo Map)
    const esriTopoTile = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 20,
      maxNativeZoom: 19,
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, USGS'
    });

    // 기본 지도 적용 (OSM DE — 고줌에서도 빈 타일 없음)
    osmDeTile.addTo(map);

    // 지도 스타일 선택 컨트롤
    L.control.layers({
      '거리 지도 (기본)': osmDeTile,
      '위성 하이브리드': hybridTile,
      '순수 위성 사진': satelliteTile,
      'Esri 거리 지도': esriStreetTile,
      '지형 지도': esriTopoTile
    }, null, { position: 'topright' }).addTo(map);

    // 마커 클러스터 그룹 초기화
    clusterGroup = L.markerClusterGroup({
      chunkedLoading: true,
      chunkInterval: 100,
      chunkDelay: 20,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      maxClusterRadius: 50,
      iconCreateFunction: function (cluster) {
        const count = cluster.getChildCount();
        let sizeClass = 'marker-cluster-small';
        let size = 36;
        if (count > 50) {
          sizeClass = 'marker-cluster-medium';
          size = 42;
        }
        if (count > 200) {
          sizeClass = 'marker-cluster-large';
          size = 48;
        }

        return L.divIcon({
          html: `<div style="width: ${size}px; height: ${size}px;"><span>${count.toLocaleString()}</span></div>`,
          className: sizeClass,
          iconSize: L.point(size, size)
        });
      }
    });

    map.addLayer(clusterGroup);

    return map;
  }

  // 마커 렌더링 업데이트
  function updateMarkers(stores, fitBounds = false) {
    if (!clusterGroup) return;

    clusterGroup.clearLayers();
    storeMarkerMap.clear();

    const markers = [];
    const latLngs = [];

    stores.forEach(store => {
      if (!store.lat || !store.lng) return;

      const marker = L.marker([store.lat, store.lng], {
        icon: createCustomIcon(store.brand),
        title: `${store.name} ${store.branch || ''}`.trim()
      });

      marker.bindPopup(createPopupHTML(store), {
        maxWidth: 320,
        className: 'custom-leaflet-popup'
      });

      // 마커 클릭 시 살짝 센터링
      marker.on('click', () => {
        map.panTo([store.lat, store.lng]);
      });

      markers.push(marker);
      latLngs.push([store.lat, store.lng]);
      storeMarkerMap.set(store.id, marker);
    });

    clusterGroup.addLayers(markers);

    if (fitBounds && latLngs.length > 0) {
      const bounds = L.latLngBounds(latLngs);
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }

  // 특정 편의점으로 포커스 및 팝업 열기
  function focusStore(store) {
    if (!map || !store) return;

    const latLng = [store.lat, store.lng];
    map.flyTo(latLng, 16, { duration: 0.8 });

    setTimeout(() => {
      const marker = storeMarkerMap.get(store.id);
      if (marker) {
        clusterGroup.zoomToShowLayer(marker, () => {
          marker.openPopup();
        });
      }
    }, 400);
  }

  // 특정 구/군 중심 좌표로 이동
  function focusGu(guName) {
    if (!map) return;

    if (guName === 'all' || !GU_CENTERS[guName]) {
      map.flyTo([35.1796, 129.0756], 11, { duration: 0.8 });
      return;
    }

    const target = GU_CENTERS[guName];
    map.flyTo([target.lat, target.lng], target.zoom, { duration: 0.8 });
  }

  // 내 위치 (GPS) 찾기
  function locateUser(onSuccess, onError) {
    if (!navigator.geolocation) {
      if (onError) onError('현재 브라우저에서 위치 서비스를 지원하지 않습니다.');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;

        if (userMarker) map.removeLayer(userMarker);
        if (userCircle) map.removeLayer(userCircle);

        const accuracy = Math.min(pos.coords.accuracy || 100, 500);

        const userIcon = L.divIcon({
          className: 'user-location-marker',
          iconSize: [22, 22],
          iconAnchor: [11, 11]
        });

        userCircle = L.circle([lat, lng], {
          radius: Math.max(accuracy, 200),
          color: '#2563eb',
          fillColor: '#3b82f6',
          fillOpacity: 0.12,
          weight: 1.5
        }).addTo(map);

        userMarker = L.marker([lat, lng], { icon: userIcon, zIndexOffset: 2000 })
          .addTo(map)
          .bindPopup(`
            <div class="p-2.5 text-center font-sans">
              <span class="inline-block px-2 py-0.5 bg-blue-100 text-blue-800 text-[11px] font-bold rounded-full mb-1">내 위치</span>
              <p class="text-xs font-bold text-slate-800">현재 계신 위치입니다</p>
              <p class="text-[10px] text-slate-400 mt-0.5">오차 반경 약 ${Math.round(accuracy)}m</p>
            </div>
          `);

        map.flyTo([lat, lng], 15, { duration: 1.0 });

        if (onSuccess) onSuccess({ lat, lng, accuracy });
      },
      (err) => {
        let msg = '위치 정보를 가져올 수 없습니다.';
        if (err.code === 1) msg = '위치 권한이 허용되지 않았습니다. 브라우저 주소창 좌측의 설정/자물쇠 아이콘에서 위치 권한을 허용해 주세요.';
        else if (err.code === 2) msg = '현재 위치를 확인할 수 없습니다.';
        else if (err.code === 3) msg = '위치 확인 요청 시간이 초과되었습니다.';
        if (onError) onError(msg);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
    );
  }

  // 부산 전체 뷰로 리셋
  function resetView() {
    if (!map) return;
    map.flyTo([35.1796, 129.0756], 11, { duration: 0.8 });
  }

  return {
    init,
    updateMarkers,
    focusStore,
    focusGu,
    locateUser,
    resetView,
    getMap: () => map,
    GU_CENTERS,
    BRAND_CONFIG
  };
})();
