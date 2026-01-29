function validateBattleConfig(config) {
    if (!config || typeof config !== 'object') throw new Error('Неверная структура battle_setup');
    if (!config.armies || !config.armies.attackers || !config.armies.defenders) {
        throw new Error('Отсутствуют армии attackers/defenders');
    }
}

function validateAdventureConfig(cfg) {
    if (!cfg || typeof cfg !== 'object') throw new Error('Неверная структура adventure_config');
    if (!cfg.adventure || typeof cfg.adventure !== 'object') throw new Error('Отсутствует adventure');
    if (!Array.isArray(cfg.adventure.startingCurrencies)) throw new Error('startingCurrencies должен быть массивом');
    if (!Array.isArray(cfg.sectors) || cfg.sectors.length === 0) throw new Error('sectors должен быть непустым массивом');
    cfg.sectors.forEach(function(s){
        if (!s || typeof s.number !== 'number' || s.number < 1) throw new Error('sector.number должен быть числом >= 1');
        if (s.name != null && typeof s.name !== 'string') throw new Error('sector.name должен быть строкой');
    });
    if (cfg.mapGen != null) throw new Error('mapGen должен быть вынесен в path_schemes.json');
}

function validatePathSchemesConfig(cfg){
    if (!cfg || !Array.isArray(cfg.schemes) || cfg.schemes.length === 0) throw new Error('schemes должен быть непустым массивом');
    const seen = new Set();
    cfg.schemes.forEach(function(s){
        if (!s || typeof s.sector !== 'number' || s.sector < 1) throw new Error('scheme.sector должен быть числом >= 1');
        if (seen.has(s.sector)) throw new Error('Дублирующийся scheme.sector: ' + s.sector);
        seen.add(s.sector);
        if (typeof s.edgeDensity !== 'number' || s.edgeDensity <= 0 || s.edgeDensity > 1) throw new Error('edgeDensity должен быть (0,1]');
        if (!Array.isArray(s.columns) || s.columns.length < 2) throw new Error('columns должен быть массивом (последний столбец — boss)');
        const last = s.columns[s.columns.length - 1];
        if (!last || !last.types || last.types.boss !== 1) throw new Error('последний столбец должен иметь types { boss: 1 }');
        for (let i=0;i<s.columns.length;i++){
            const col = s.columns[i];
            if (!col || !Array.isArray(col.widthRange) || col.widthRange.length !== 2) throw new Error('column.widthRange должен быть [min,max]');
            if (typeof col.widthRange[0] !== 'number' || typeof col.widthRange[1] !== 'number') throw new Error('widthRange элементы должны быть числами');
            if (col.tier != null && typeof col.tier !== 'number') throw new Error('column.tier должен быть числом');
            if (!col.types || typeof col.types !== 'object') throw new Error('column.types обязателен (weight map)');
        }
    });
}
window.validatePathSchemesConfig = validatePathSchemesConfig;

function validateEncountersConfig(cfg) {
    if (!cfg || !Array.isArray(cfg.encounters)) throw new Error('Неверная структура encounters_config');
    cfg.encounters.forEach(function(e){
        if (!e || typeof e.id !== 'string') throw new Error('Встреча должна содержать id');
        if (!Array.isArray(e.monsters)) throw new Error('Встреча должна содержать monsters');
        if (e.rewardId != null && typeof e.rewardId !== 'string') throw new Error('rewardId должен быть строкой');
        if (e.rewards != null && !Array.isArray(e.rewards)) throw new Error('rewards должен быть массивом');
        if (Array.isArray(e.rewards)) {
            e.rewards.forEach(function(r){
                if (!r || (r.type !== 'currency' && r.type !== 'monster')) throw new Error('reward.type должен быть currency или monster');
                if (typeof r.id !== 'string') throw new Error('reward.id должен быть строкой');
                if (typeof r.amount !== 'number') throw new Error('reward.amount должен быть числом');
            });
        }
        // Валидация монстров: amount — число или строка диапазона 'min-max'
        e.monsters.forEach(function(m){
            if (!m || typeof m.id !== 'string') throw new Error('monster.id должен быть строкой');
            const v = m.amount;
            const okNumber = typeof v === 'number';
            const okRange = (typeof v === 'string' && /^\s*\d+\s*-\s*\d+\s*$/.test(v));
            if (!okNumber && !okRange) throw new Error('monster.amount должен быть числом или строкой диапазона');
        });
    });
}

function validateEventsConfig(cfg){
    if (!cfg || !Array.isArray(cfg.events)) throw new Error('Неверная структура events_config');
    cfg.events.forEach(function(e){
        if (!e || typeof e.id !== 'string') throw new Error('Событие должно содержать id');
        if (typeof e.tier !== 'number') throw new Error('Событие должно содержать числовой tier');
        if (!Array.isArray(e.options)) throw new Error('Событие должно содержать options');
        e.options.forEach(function(o){ if (!o || typeof o.id !== 'string' || typeof o.text !== 'string') throw new Error('option требует id и text'); });
    });
}
window.validateEventsConfig = validateEventsConfig;

function validateCurrenciesConfig(cfg) {
    if (!cfg || !Array.isArray(cfg.currencies)) throw new Error('Неверная структура currencies_config');
    cfg.currencies.forEach(function(c){ if (!c || typeof c.id !== 'string' || typeof c.name !== 'string') throw new Error('Валюта должна содержать id и name'); });
}

// validateRewardsConfig удалён — награды теперь inline в encounters

function validateMonstersConfig(cfg) {
    const src = (cfg && cfg.unitTypes) ? cfg.unitTypes : cfg;
    if (!src || typeof src !== 'object') throw new Error('Неверная структура monsters_config');
}

function validateMercenariesConfig(cfg) {
    const list = Array.isArray(cfg) ? cfg : (cfg && Array.isArray(cfg.mercenaries) ? cfg.mercenaries : null);
    if (!list) throw new Error('Неверная структура mercenaries_config');
    for (const it of list) {
        if (!it || typeof it.id !== 'string') throw new Error('Некорректный наёмник в mercenaries_config');
        if (!Array.isArray(it.price)) throw new Error('Цена наёмника должна быть массивом валют');
        it.price.forEach(function(p){ if (!p || typeof p.id !== 'string' || typeof p.amount !== 'number') throw new Error('Элемент price должен содержать id и amount'); });
        if (it.tier != null && typeof it.tier !== 'number') throw new Error('tier должен быть числом');
        if (it.classes != null && !Array.isArray(it.classes)) throw new Error('classes должен быть массивом строк');
    }
}

window.validateBattleConfig = validateBattleConfig;
window.validateAdventureConfig = validateAdventureConfig;
window.validateMonstersConfig = validateMonstersConfig;
window.validateMercenariesConfig = validateMercenariesConfig;
window.validateEncountersConfig = validateEncountersConfig;

function validateRewardsConfig(cfg){
    if (!cfg || !Array.isArray(cfg.tables)) throw new Error('Неверная структура rewards_config');
    cfg.tables.forEach(function(t){
        if (!t || typeof t.id !== 'string') throw new Error('Таблица наград должна содержать id');
        if (typeof t.tier !== 'number') throw new Error('Таблица наград должна содержать числовой tier');
        if (t.tags != null && !Array.isArray(t.tags)) throw new Error('tags должен быть массивом строк');
        if (typeof t.mode !== 'string' || (t.mode !== 'all' && t.mode !== 'select')) throw new Error('mode должен быть all или select');
        if (!Array.isArray(t.rewards)) throw new Error('rewards должен быть массивом');
        t.rewards.forEach(function(r){
            if (!r || (r.type !== 'currency' && r.type !== 'unit' && r.type !== 'perk')) throw new Error('reward.type должен быть currency, unit или perk');
            if (typeof r.id !== 'string') throw new Error('reward.id должен быть строкой');
            if (r.amount == null) throw new Error('reward.amount обязателен');
            var okNumber = (typeof r.amount === 'number' && r.amount >= 0);
            var okRange = (typeof r.amount === 'string' && /^\s*\d+\s*-\s*\d+\s*$/.test(r.amount));
            if (!okNumber && !okRange) throw new Error('reward.amount должен быть числом или строкой диапазона "min-max"');
        });
    });
}
window.validateRewardsConfig = validateRewardsConfig;
window.validateCurrenciesConfig = validateCurrenciesConfig;
function validateAchievementsConfig(cfg) {
    const list = Array.isArray(cfg && cfg.achievements) ? cfg.achievements : [];
    list.forEach(function(a){
        if (!a || typeof a.id !== 'string') throw new Error('Достижение должно содержать id');
        if (typeof a.name !== 'string' || typeof a.description !== 'string') throw new Error('Достижение должно содержать name и description');
        if (typeof a.icon !== 'string') throw new Error('Достижение должно содержать icon');
        if (a.type !== 'monster' && a.type !== 'currency') throw new Error('achievement.type должен быть monster или currency');
        if (typeof a.id_entity !== 'string') throw new Error('achievement.id_entity должен быть строкой');
        if (typeof a.amount !== 'number') throw new Error('achievement.amount должен быть числом');
    });
}
window.validateAchievementsConfig = validateAchievementsConfig;
function validateHeroClassesConfig(cfg) {
    const list = Array.isArray(cfg) ? cfg : (cfg && Array.isArray(cfg.classes) ? cfg.classes : null);
    if (!list) throw new Error('Неверная структура hero_classes');
    list.forEach(function(c){
        if (!c || typeof c.id !== 'string' || typeof c.name !== 'string') throw new Error('Класс героя должен содержать id и name');
        if (!Array.isArray(c.startingArmy)) throw new Error('Класс героя должен содержать startingArmy');
        c.startingArmy.forEach(function(g){ if (!g || typeof g.id !== 'string' || typeof g.count !== 'number') throw new Error('Некорректная запись startingArmy'); });
        if (c.development) {
            if (!c.development || !Array.isArray(c.development.levels)) throw new Error('development.levels должен быть массивом');
            c.development.levels.forEach(function(l){
                if (typeof l.level !== 'number') throw new Error('level должен быть числом');
                if (!Array.isArray(l.price)) throw new Error('price уровня должен быть массивом валют');
                l.price.forEach(function(p){ if (!p || typeof p.id !== 'string' || typeof p.amount !== 'number') throw new Error('price: элементы должны содержать id и amount'); });
                if (l.autoUpgrades && !Array.isArray(l.autoUpgrades)) throw new Error('autoUpgrades должен быть массивом');
                if (l.paidUpgrades && !Array.isArray(l.paidUpgrades)) throw new Error('paidUpgrades должен быть массивом');
            });
        }
    });
}
window.validateHeroClassesConfig = validateHeroClassesConfig;

function validateHeroUpgradesConfig(cfg){
    const list = Array.isArray(cfg) ? cfg : (cfg && Array.isArray(cfg.upgrades) ? cfg.upgrades : null);
    if (!list) throw new Error('Неверная структура hero_upgrades');
    list.forEach(function(u){
        if (!u || typeof u.id !== 'string' || typeof u.name !== 'string') throw new Error('Улучшение должно содержать id и name');
        if (typeof u.icon !== 'string' || typeof u.description !== 'string') throw new Error('Улучшение должно содержать icon и description');
        if (u.price && !Array.isArray(u.price)) throw new Error('price должен быть массивом');
        (u.price || []).forEach(function(p){ if (!p || typeof p.id !== 'string' || typeof p.amount !== 'number') throw new Error('price: элементы должны содержать id и amount'); });
        if (u.grantsPerks && !Array.isArray(u.grantsPerks)) throw new Error('grantsPerks должен быть массивом строк');
    });
}
window.validateHeroUpgradesConfig = validateHeroUpgradesConfig;

function validatePerksConfig(cfg){
    const list = Array.isArray(cfg) ? cfg : (cfg && Array.isArray(cfg.perks) ? cfg.perks : null);
    if (!list) throw new Error('Неверная структура perks_config');
    list.forEach(function(p){
        if (!p || typeof p.id !== 'string' || typeof p.name !== 'string') throw new Error('Перк должен содержать id и name');
        if (typeof p.icon !== 'string' || typeof p.description !== 'string') throw new Error('Перк должен содержать icon и description');
        if (p.hidden != null && typeof p.hidden !== 'boolean') throw new Error('hidden должен быть boolean');
        if (!Array.isArray(p.effects)) throw new Error('effects должен быть массивом');
        p.effects.forEach(function(e){
            if (!e || typeof e.type !== 'string') throw new Error('effect.type обязателен');
            if (e.type === 'stat' || e.type === 'multiplier') {
                if (typeof e.path !== 'string' || typeof e.value !== 'number') throw new Error('stat/multiplier требуют path и value');
            }
        });
    });
}
window.validatePerksConfig = validatePerksConfig;

function validateDevelopmentTracksConfig(cfg){
    const list = Array.isArray(cfg) ? cfg : (cfg && Array.isArray(cfg.tracks) ? cfg.tracks : null);
    if (!list) throw new Error('Неверная структура development_tracks');
    const ids = new Set();
    list.forEach(function(t){
        if (!t || typeof t.id !== 'string' || typeof t.name !== 'string') throw new Error('Трек должен содержать id и name');
        if (ids.has(t.id)) throw new Error('Дублирующийся id трека: ' + t.id);
        ids.add(t.id);
        if (typeof t.icon !== 'string') throw new Error('Трек должен содержать icon');
        if (typeof t.currencyId !== 'string') throw new Error('Трек должен содержать currencyId');
        if (typeof t.unitCost !== 'number' || !(t.unitCost > 0)) throw new Error('unitCost должен быть положительным числом');
        if (!Array.isArray(t.thresholds)) throw new Error('thresholds должен быть массивом');
        let prev = -Infinity;
        t.thresholds.forEach(function(th){
            if (!th || typeof th.value !== 'number') throw new Error('Порог должен содержать числовое value');
            if (th.value <= prev) throw new Error('Пороги должны быть строго возрастающими');
            prev = th.value;
            if (th.grantsPerks && !Array.isArray(th.grantsPerks)) throw new Error('grantsPerks должен быть массивом строк');
        });
    });
}
window.validateDevelopmentTracksConfig = validateDevelopmentTracksConfig;