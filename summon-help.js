// Summon Helper for Foundry VTT v12 Pathfinder 2e
Hooks.on('ready', async () => {
  // Listen for spell casting with summon trait
  Hooks.on('createChatMessage', async (message, options, userId) => {
    const origin = message.flags?.pf2e?.origin;
    if (origin?.type === 'spell' && origin?.rollOptions?.includes('origin:item:trait:summon')) {
      // Get actor from origin.actor (UUID)
      const actorId = origin.actor?.replace('Actor.', '');
      const actor = game.actors.get(actorId);
      // Try to get the spell item from the UUID
      let spellItem = null;
      if (origin?.uuid) {
        spellItem = await fromUuid(origin.uuid);
      }
      let range = null;
      if (spellItem && spellItem.system?.range?.value) {
        range = spellItem.system.range.value;
      }
  // (Template placement is now handled only after clicking Summon this!)
    showSummonWindow({name: 'Summon Spell', range}, actor);
    }
  });
});

async function showSummonWindow(item, actor) {
  // Search for any folder named '<character_name> Summons' anywhere, regardless of parent
  let folder = null;
  if (actor && actor.name) {
    const allFolders = game.folders.contents;
    const subfolderName = `${actor.name} Summons`;
    folder = allFolders.find(f => f.name === subfolderName);
    if (!folder) {
      ui.notifications.info(`No folder found named: ${subfolderName}`);
    }
  }
  if (!folder) {
    ui.notifications.warn(`Summons folder for this character not found! (Summons/<character_name> Summons)`);
    return;
  }
  // Get all actors in the folder
  const actors = folder.contents.filter(a => a.documentName === 'Actor');
  if (!actors.length) {
    ui.notifications.warn('No creatures found in this character\'s Summons folder!');
    return;
  }
  // Gather levels and build dropdowns


  // Prepare actors with level and traits info, sort by level ascending
  let actorsWithLevel = actors.map(a => {
    let level = a.system?.details?.level?.value ?? a.system?.level ?? '';
    let traits = a.system?.traits?.value || [];
    return { id: a.id, name: a.name, level: Number(level) || 0, traits };
  });
  actorsWithLevel.sort((a, b) => a.level - b.level);

  let actorLevels = actorsWithLevel.map(a => a.level).filter(lvl => lvl !== '').map(Number);
  let uniqueLevels = [...new Set(actorLevels)].sort((a, b) => a - b);
  let levelOptions = uniqueLevels.map(lvl => `<div class="summon-level-option" data-level="${lvl}">${lvl}</div>`).join('');

  // Gather all unique traits for all creatures (for initial render)
  let allTraits = Array.from(new Set(actorsWithLevel.flatMap(a => a.traits))).sort();
  let traitCheckboxes = allTraits.map(trait => `
    <label style="margin-right:8px;"><input type="checkbox" class="trait-filter" value="${trait}"> ${trait}</label>
  `).join('');

  // By default, show all creatures sorted by level
  let creatureOptions = actorsWithLevel.map(a => {
    return `<div class="summon-creature-option" data-id="${a.id}" data-level="${a.level}" data-traits="${a.traits.join(',')}">LVL${a.level} ${a.name}</div>`;
  }).join('');

  let html = `<form style='display:flex;flex-direction:column;'>
    <div style="padding: 8px 0 0 0;">
      <div style="display: flex; align-items: flex-start; gap: 24px;">
        <div style="min-width: 60px;">
          <label style="font-weight:bold;">Level:</label><br>
          <div id='level-list' style="display: flex; flex-direction: column; gap: 2px; margin-top: 2px;">
            <div class="summon-level-option" data-level="">All</div>
            ${levelOptions}
          </div>
        </div>
        <div style="flex:1;">
          <div style="font-weight:bold; margin-bottom: 2px;">Traits:</div>
          <div id='trait-filters' style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px 8px;">
            ${traitCheckboxes}
          </div>
        </div>
      </div>
    </div>
    <br>
    <div style="display:flex;align-items:center;margin-bottom:2px;gap:12px;">
      <label style="margin:0;">Choose a creature:</label>
      <label style="display:flex;align-items:center;gap:4px;font-weight:normal;font-size:13px;">
        <input type="checkbox" id="place-template-checkbox"> Place template?
      </label>
    </div>
    <div id='summon-list' style='max-height: 176px; overflow-y: auto; border: 1px solid #ccc; border-radius: 4px; padding: 0; flex:1 1 auto;'>
      ${creatureOptions}
    </div>
    <button type='button' id='summon-btn' style='width:100%;margin-top:8px;position:sticky;bottom:0;z-index:10;background:#4caf50;color:white;font-weight:bold;'>Summon this!</button>
  </form>`;
  let d = new Dialog({
    title: 'Summon Creature',
    content: html,
    buttons: {},
    render: html => {
      // Make creature list scroll smoothly and by 1 item per wheel event
      const $summonList = html.find('#summon-list');
  $summonList.css('scroll-behavior', 'auto');
      $summonList.on('wheel', function(e) {
        e.preventDefault();
        const delta = Math.sign(e.originalEvent.deltaY);
        const step = Math.round($(this).height() / 2); // 50% of visible area
        this.scrollTop += delta * step;
      });
      // Add some basic styling for selected creature and sticky button (only once)
      if (!document.getElementById('summon-helper-style')) {
        const style = document.createElement('style');
        style.id = 'summon-helper-style';
        style.textContent = `
          .summon-creature-option {
            cursor: pointer;
            padding: 0 6px;
            border-radius: 3px;
            line-height: 22px;
            min-height: 22px;
            font-size: 14px;
            margin: 0;
          }
          .summon-creature-option.selected { background: #4caf50; color: white; }
          .summon-creature-option:hover { background: #e0e0e0; }
          .summon-level-option { cursor: pointer; padding: 2px 6px; border-radius: 3px; text-align: center; }
          .summon-level-option.selected { background: #1976d2; color: white; font-weight: bold; }
          .summon-level-option:hover { background: #e0e0e0; }
          #summon-btn { box-shadow: 0 2px 6px rgba(0,0,0,0.08); }
          form { height: 100%; min-height: 320px; }
          #trait-filters label { display: flex; align-items: center; gap: 4px; font-size: 13px; padding: 2px 0; }
          #trait-filters { margin-bottom: 2px; }
          #summon-list { max-height: 176px !important; padding: 0 !important; }
        `;
        document.head.appendChild(style);
      }
      // Store all creature options for reliable re-filtering
      const allCreatureOptions = html.find('.summon-creature-option').map(function() {
        return $(this).clone();
      }).get();

      // Filtering function
      let selectedLevel = null;
      function filterCreatures() {
        // Reset scroll to top
        html.find('#summon-list').scrollTop(0);
        // Get highest selected level from .summon-level-option.selected
        const selectedLevelDivs = html.find('.summon-level-option.selected');
        let maxLevel = null;
        selectedLevelDivs.each(function() {
          const lvl = $(this).data('level');
          if (lvl !== "" && lvl !== undefined) {
            if (maxLevel === null || Number(lvl) > maxLevel) maxLevel = Number(lvl);
          }
        });
        selectedLevel = maxLevel;
        const selectedTraits = html.find('.trait-filter:checked').map(function() { return this.value; }).get();
        let filtered = allCreatureOptions.filter(function(opt) {
          const creatureLevel = Number($(opt).data('level'));
          const creatureTraits = ($(opt).data('traits') || '').split(',').filter(Boolean);
          // Level filter
          if (selectedLevel !== null && creatureLevel > selectedLevel) return false;
          // Trait filter: must have all selected traits
          if (selectedTraits.length && !selectedTraits.every(trait => creatureTraits.includes(trait))) return false;
          return true;
        });
        filtered = filtered.sort(function(a, b) {
          return Number($(b).data('level')) - Number($(a).data('level'));
        });
        html.find('#summon-list').empty();
        if (filtered.length === 0) {
          html.find('#summon-list').append(`<div class='summon-creature-placeholder' style='color:#888;text-align:center;padding:8px;'>No creatures like this!</div>`);
        } else {
          html.find('#summon-list').append(filtered);
          // Select the first visible creature
          html.find('.summon-creature-option').removeClass('selected');
          const firstVisible = html.find('.summon-creature-option').first();
          if (firstVisible.length) {
            firstVisible.addClass('selected');
          }
        }
      }

      // Level list selection logic
      html.on('click', '.summon-level-option', function() {
        // Mark this and all lower levels as selected
        const clickedLevel = $(this).data('level');
        html.find('.summon-level-option').removeClass('selected');
        if (clickedLevel === "" || clickedLevel === undefined) {
          // All
          html.find('.summon-level-option[data-level=""]').addClass('selected');
        } else {
          html.find('.summon-level-option').each(function() {
            const lvl = $(this).data('level');
            if (lvl === "" || lvl === undefined) return;
            if (Number(lvl) <= Number(clickedLevel)) {
              $(this).addClass('selected');
            }
          });
        }
        filterCreatures();
      });
      // Default: select 'All'
      html.find('.summon-level-option[data-level=""]').addClass('selected');

      html.find('.trait-filter').on('change', filterCreatures);

      // Selection logic for the list
      html.on('click', '.summon-creature-option', function() {
        html.find('.summon-creature-option').removeClass('selected');
        $(this).addClass('selected');
      });

      // Initial selection
      html.find('.summon-creature-option').first().addClass('selected');

      html.find('#summon-btn').click(async () => {
        const selectedDiv = html.find('.summon-creature-option.selected');
        if (!selectedDiv.length) return ui.notifications.warn('No creature selected!');
        const summonActorId = selectedDiv.data('id');
        const summonActor = game.actors.get(summonActorId);
        if (!summonActor) return ui.notifications.warn('Actor not found!');
        // Place template if requested
        const placeTemplate = html.find('#place-template-checkbox').is(':checked');
        if (placeTemplate && item.range && actor) {
          let distance = null;
          if (typeof item.range === 'number') {
            distance = item.range;
          } else if (typeof item.range === 'string') {
            const match = item.range.match(/(\d+)/);
            if (match) distance = parseInt(match[1], 10);
          }
          if (Number.isFinite(distance)) {
            // Find the caster's token on the canvas
            const casterToken = canvas.tokens.placeables.find(t => t.actor?.id === actor.id);
            if (casterToken) {
              const templateData = {
                t: "circle",
                user: game.user.id,
                x: casterToken.center.x,
                y: casterToken.center.y,
                distance: distance,
                direction: 0,
                fillColor: game.user.color
              };
              await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [templateData]);
            }
          }
        }
        // Place token adjacent to caster's token if available
        let pos;
        const casterToken = canvas.tokens.controlled[0];
        if (casterToken) {
          // Place to the right (east) of caster
          const gridSize = canvas.scene.grid.size;
          pos = {
            x: casterToken.x + gridSize,
            y: casterToken.y
          };
        } else {
          // Default to center of scene
          pos = {x: canvas.scene.width/2, y: canvas.scene.height/2};
        }
        // Prepare token data from actor prototype
        const tokenData = foundry.utils.duplicate(summonActor.prototypeToken);
        tokenData.x = pos.x;
        tokenData.y = pos.y;
        tokenData.actorId = summonActor.id;
        await canvas.scene.createEmbeddedDocuments("Token", [tokenData]);
        d.close();
      });
      // Add some basic styling for selected creature
      const style = `<style>
        .summon-creature-option { cursor: pointer; padding: 2px 6px; border-radius: 3px; }
        .summon-creature-option.selected { background: #4caf50; color: white; }
        .summon-creature-option:hover { background: #e0e0e0; }
      </style>`;
      html.closest('.app').append(style);
    }
  });
  d.render(true);
}
