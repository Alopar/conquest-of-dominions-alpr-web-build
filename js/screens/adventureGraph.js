(function(){

    function lcg(seed){
        let s = (Number(seed)||1) >>> 0;
        return function(){ s = (1664525 * s + 1013904223) >>> 0; return s/4294967296; };
    }

    function pickWeighted(list, getW){
        let sum = 0; for (const it of list) sum += Math.max(0, Number(getW(it)||0));
        if (sum <= 0) return list[0] || null;
        let r = Math.random() * sum;
        for (const it of list){ r -= Math.max(0, Number(getW(it)||0)); if (r <= 0) return it; }
        return list[list.length-1] || null;
    }

    function generateAdventureMap(cfg, seed){
        const gen = (cfg && cfg.mapGen) || {};
        // Новая схема: cfg.mapGen.columns[] и cfg.mapGen.edgeDensity, без depth/seeded/guaranteePath/tierByDepth/mixByDepth
        const columnsSpec = Array.isArray(gen.columns) ? gen.columns : [];
        const edgeDensity = Math.min(1, Math.max(0.05, Number((gen.edgeDensity!=null?gen.edgeDensity:0.5))));
        const rand = Math.random;
        const nodes = {}; const columns = [];
        function addNode(d, idx){
            const id = `n_${d}_${idx}`; const x = d, y = idx;
            nodes[id] = { id, depth: d, x, y, type: 'battle', tier: 1 };
            return nodes[id];
        }
        // Колонка 0 — старт, один узел
        columns.push([ (function(){ const n = addNode(0,0); n.type = 'start'; n.class = undefined; n.tier = undefined; return n; })() ]);
        // Колонки по спецификации (включая последний столбец)
        for (let i=0;i<columnsSpec.length;i++){
            const spec = columnsSpec[i];
            const d = i + 1; // индекс столбца относительно старта
            const wMin = Math.max(1, Number((spec && spec.widthRange && spec.widthRange[0])||1));
            const wMax = Math.max(wMin, Number((spec && spec.widthRange && spec.widthRange[1])||wMin));
            const w = Math.round(wMin + (wMax - wMin) * rand());
            const col = []; for (let i2=0;i2<w;i2++){ col.push(addNode(d,i2)); }
            col._spec = spec || {};
            columns.push(col);
        }
        const lastIndex = columns.length - 1; // индекс последней (босс) колонки
        const contentDepth = Math.max(0, lastIndex - 1);

        const edges = []; const edgeSet = new Set();
        function addEdge(a,b){ const k=a+">"+b; if (edgeSet.has(k)) return; edgeSet.add(k); edges.push({ from:a, to:b }); }
        // Из старта — ко всем узлам первой «содержательной» колонки
        for (const b of columns[1]) addEdge(columns[0][0].id, b.id);
        // Между внутренними колонками 1..contentDepth-1
        for (let d=1; d<lastIndex; d++){
            const a = columns[d]; const b = columns[d+1];
            for (let i=0;i<a.length;i++){
                for (let j=0;j<b.length;j++){
                    if (rand() < edgeDensity){ addEdge(a[i].id, b[j].id); }
                }
            }
            // Обеспечиваем связность: у каждого из A есть исходящая в B, у каждого из B есть входящая из A
            for (const n of a){
                if (!edges.some(e => e.from === n.id && b.some(x => x.id === e.to))) {
                    const target = b[Math.floor(rand()*b.length)];
                    addEdge(n.id, target.id);
                }
            }
            for (const n of b){
                if (!edges.some(e => e.to === n.id && a.some(x => x.id === e.from))) {
                    const source = a[Math.floor(rand()*a.length)];
                    addEdge(source.id, n.id);
                }
            }
        }
        // Отдельной прошивки к последней колонке не требуется: цикл выше соединил d..d+1, включая последнюю пару

        // Гарантируем хотя бы один путь: старт -> ... -> последняя колонка (босс)
        let prev = pickWeighted(columns[1], () => 1);
        for (let d=2; d<=lastIndex; d++){
            const next = pickWeighted(columns[d], () => 1);
            addEdge(prev.id, next.id);
            prev = next;
        }

        // Расстановка типов/тиров: по спецификации столбцов 1..contentDepth
        function rollType(m){
            const entries = Object.keys(m||{}).map(k => ({ k, w: Number(m[k]||0) }));
            const chosen = pickWeighted(entries, e => e.w);
            return (chosen && chosen.k) || 'battle';
        }
        for (let d=1; d<=lastIndex; d++){
            const spec = columns[d]._spec || {};
            const isLast = (d === lastIndex);
            const mixRow = isLast ? { boss: 1 } : (spec.types || { battle: 1 });
            const tier = spec.tier;
            for (const n of columns[d]){
                n.type = rollType(mixRow);
                n.tier = (tier!=null ? Number(tier) : undefined);
                if (n.type === 'elite') n.class = 'elite';
                else if (n.type === 'battle') n.class = 'normal';
                else if (n.type === 'boss') { n.class = 'boss'; }
            }
        }
        // последний столбец уже размечен как boss

        const startId = columns[0][0].id;
        return { nodes, edges, startId };
    }

    function getNeighbors(map, nodeId){
        const res = [];
        for (const e of map.edges){ if (e.from === nodeId) res.push(e.to); }
        return res;
    }

    function isNodeAvailable(state, nodeId){
        if (!state || !state.map) return false;
        if (!state.currentNodeId) return nodeId === (state.map.startId || null);
        if ((state.resolvedNodeIds||[]).includes(nodeId)) return false;
        return getNeighbors(state.map, state.currentNodeId).includes(nodeId);
    }

    function pickEncounterFor(params){
        try {
            const cfg = (window.StaticData && window.StaticData.getConfig) ? window.StaticData.getConfig('encounters') : null;
            const list = (cfg && Array.isArray(cfg.encounters)) ? cfg.encounters : [];
            const cls = params.class || 'normal';
            const hasTier = (params.tier != null);
            const tier = hasTier ? Number(params.tier) : undefined;
            if (!hasTier || isNaN(tier)) return null;
            const pool = list.filter(function(e){
                const et = Number(e && e.tier);
                if (cls === 'boss') return e.class === 'boss' && et === tier;
                if (cls === 'elite') return e.class === 'elite' && et === tier;
                return e.class === 'normal' && et === tier;
            });
            if (pool.length === 0) return null;
            return pickWeighted(pool, e => Number(e.weight||1));
        } catch { return null; }
    }

    function renderSvgGraph(container, map, options){
        if (!container || !map || !map.nodes) return null;
        container.innerHTML = '';
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'adv-map-svg');
        const padX = (options && options.padX) || 120;
        const padY = (options && options.padY) || 120;
        const colGap = (options && options.colGap) || 180;   // минимальный горизонтальный шаг между колонками
        const rowGap = (options && options.rowGap) || 120;    // минимальный вертикальный шаг между нодами

        // Строим колонки по значениям x
        const allNodes = Object.values(map.nodes);
        const maxX = Math.max(...allNodes.map(n => n.x));
        const colCount = maxX + 1;
        const columnsByX = Array.from({ length: colCount }, () => []);
        allNodes.forEach(n => { columnsByX[n.x].push(n); });
        columnsByX.forEach(col => col.sort((a,b) => (a.y||0) - (b.y||0)));
        const maxRows = Math.max(...columnsByX.map(c => c.length));

        // Рассчитываем размеры полотна по самым высоким/широким колонкам
        const width = Math.max(800, padX * 2 + (colCount - 1) * colGap);
        const height = Math.max(400, padY * 2 + Math.max(0, (maxRows - 1)) * rowGap);
        svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
        svg.setAttribute('width', String(width));
        svg.setAttribute('height', String(height));
        container.appendChild(svg);
        // Позиции: колонки равномерно по ширине, ноды — равномерно по высоте колонки и центрированы
        const xAt = []; for (let i=0;i<colCount;i++) xAt[i] = padX + i * colGap;
        const posOf = {};
        for (let cx=0; cx<colCount; cx++){
            const col = columnsByX[cx];
            const m = col.length;
            if (m === 0) continue;
            const usedHeight = (m - 1) * rowGap;
            const totalHeight = (maxRows - 1) * rowGap;
            const offset = (totalHeight - usedHeight) / 2; // центрирование относительно самой высокой колонки
            for (let i=0;i<m;i++){
                const n = col[i];
                posOf[n.id] = { x: xAt[cx], y: padY + offset + i * rowGap };
            }
        }
        const s2 = (typeof window.getCurrentSettings === 'function') ? window.getCurrentSettings() : {};
        const hidePath = !!(s2 && s2.mapSettings && s2.mapSettings.hidePath);
        const visitedSetForEdges = (function(){
            try { return new Set((window.adventureState && Array.isArray(window.adventureState.resolvedNodeIds)) ? window.adventureState.resolvedNodeIds : []); } catch { return new Set(); }
        })();
        const currentId = (function(){ try { return window.adventureState && window.adventureState.currentNodeId; } catch { return null; } })();
        const availableSet = new Set(hidePath && currentId ? getNeighbors(map, currentId) : []);
        const skippedSet = new Set();
        if (hidePath) {
            try {
                map.edges.forEach(function(e){
                    if (visitedSetForEdges.has(e.from) && !visitedSetForEdges.has(e.to) && !availableSet.has(e.to)) skippedSet.add(e.to);
                });
            } catch {}
        }
        const visibleNodeSet = new Set();
        if (hidePath) {
            visitedSetForEdges.forEach(function(id){ visibleNodeSet.add(id); });
            availableSet.forEach(function(id){ visibleNodeSet.add(id); });
            skippedSet.forEach(function(id){ visibleNodeSet.add(id); });
        }
        // edges
        map.edges.forEach(function(e){
            const a = map.nodes[e.from]; const b = map.nodes[e.to]; if (!a||!b) return;
            if (hidePath) { if (!(visibleNodeSet.has(a.id) && visibleNodeSet.has(b.id))) return; }
            const p1 = posOf[a.id]; const p2 = posOf[b.id];
            const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
            line.setAttribute('x1', String(p1.x)); line.setAttribute('y1', String(p1.y));
            line.setAttribute('x2', String(p2.x)); line.setAttribute('y2', String(p2.y));
            line.setAttribute('class', 'adv-edge locked');
            line.setAttribute('data-from', a.id);
            line.setAttribute('data-to', b.id);
            svg.appendChild(line);
        });
        // nodes
        const nodesGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        nodesGroup.setAttribute('class','adv-nodes');
        svg.appendChild(nodesGroup);
        const s = (typeof window.getCurrentSettings === 'function') ? window.getCurrentSettings() : {};
        const hideTypes = !!(s && s.mapSettings && s.mapSettings.hideNodeTypes);
        const visitedSet = (function(){
            try {
                const ids = (window.adventureState && Array.isArray(window.adventureState.resolvedNodeIds)) ? window.adventureState.resolvedNodeIds : [];
                return new Set(ids);
            } catch { return new Set(); }
        })();
        Object.values(map.nodes).forEach(function(n){
            if (hidePath) { if (!visibleNodeSet.has(n.id)) return; }
            const pos = posOf[n.id] || {x:padX, y:padY};
            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('data-id', n.id);
            g.setAttribute('transform', `translate(${pos.x},${pos.y})`);
            g.setAttribute('class', 'adv-node locked');
            g.style.cursor = 'pointer';
            const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
            rect.setAttribute('x', '-22'); rect.setAttribute('y', '-22'); rect.setAttribute('rx', '8'); rect.setAttribute('ry', '8');
            rect.setAttribute('width', '44'); rect.setAttribute('height', '44');
            const icon = document.createElementNS('http://www.w3.org/2000/svg', 'text');
            icon.setAttribute('text-anchor', 'middle'); icon.setAttribute('dominant-baseline', 'middle'); icon.setAttribute('fill', '#cd853f'); icon.style.fontSize = '18px';
            const isVisited = visitedSet.has(n.id);
            const t = (n.type === 'start') ? ''
                : (n.type === 'boss') ? '👑'
                : (hideTypes && !isVisited) ? '❔'
                : (n.type === 'elite') ? '💀'
                : (n.type === 'event') ? '✨'
                : '😡';
            icon.textContent = t;
            g.appendChild(rect); g.appendChild(icon);
            nodesGroup.appendChild(g);
        });
        // expose layout for external consumers (marker positioning)
        try { map._posOf = posOf; map._layout = { padX, padY, colGap, rowGap, width, height }; } catch {}
        return svg;
    }

    window.AdventureGraph = { generateAdventureMap, getNeighbors, isNodeAvailable, pickEncounterFor, renderSvgGraph };
})();


