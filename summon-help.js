// Summon Helper for Foundry VTT v12 Pathfinder 2e
Hooks.on('ready', async () => {
  // Listen for spell casting with summon trait
  Hooks.on('createChatMessage', async (message, options, userId) => {
    const origin = message.flags?.pf2e?.origin;
    
    if (origin?.type === 'spell' && origin?.rollOptions?.includes('origin:item:trait:summon')) {
      // Get actor from origin.actor (UUID)
      const actorId = origin.actor?.replace('Actor.', '');
      const actor = game.actors.get(actorId);
      
      // Fallback: If actor not found by ID, try multiple methods
      let fallbackActor = actor;
      if (!actor) {
        // Method 1: Try controlled tokens
        const controlledTokens = canvas.tokens.controlled;
        if (controlledTokens.length > 0) {
          fallbackActor = controlledTokens[0].actor;
        }
        
        // Method 2: Try message speaker
        if (!fallbackActor && message.speaker?.actor) {
          fallbackActor = game.actors.get(message.speaker.actor);
        }
        
        // Method 3: Try message speaker token
        if (!fallbackActor && message.speaker?.token) {
          const token = canvas.tokens.get(message.speaker.token);
          if (token) {
            fallbackActor = token.actor;
          }
        }
      }
      
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
      if (!fallbackActor) {
        console.error('[Summon Helper] No actor found through any method!');
        ui.notifications.error('Could not determine which character is casting the spell. Please try again.');
        return;
      }
      
      showSummonWindow({name: 'Summon Spell', range}, fallbackActor);
    }
  });
});

async function showSummonWindow(item, actor) {
  // Search for summon folder with multiple fallback strategies
  let folder = null;
  if (actor && actor.name) {
    const allFolders = game.folders.contents;
    
    // Strategy 1: Look for exact match with actor name
    const exactName = `${actor.name} Summons`;
    folder = allFolders.find(f => f.name === exactName);
    
    // Strategy 2: Look for partial match (in case of name variations)
    if (!folder) {
      const partialMatch = allFolders.find(f => 
        f.name.includes(actor.name) && f.name.toLowerCase().includes('summons')
      );
      if (partialMatch) {
        folder = partialMatch;
      }
    }
    
    // Strategy 2.5: For NPCs, also look for folders with "NPC" or "Monster" in the name
    if (!folder && actor.type === 'npc') {
      const npcMatch = allFolders.find(f => 
        (f.name.toLowerCase().includes('npc') || f.name.toLowerCase().includes('monster')) && 
        f.name.toLowerCase().includes('summons')
      );
      if (npcMatch) {
        folder = npcMatch;
      }
    }
    
    // Strategy 3: Look for any folder containing "Summons" (fallback)
    if (!folder) {
      const summonsFolder = allFolders.find(f => 
        f.name.toLowerCase().includes('summons') && f.contents.some(c => c.documentName === 'Actor')
      );
      if (summonsFolder) {
        folder = summonsFolder;
      }
    }
    
    // Show available summons folders to help user
    if (!folder) {
      const summonsFolders = allFolders.filter(f => f.name.toLowerCase().includes('summons'));
      if (summonsFolders.length > 0) {
        const folderNames = summonsFolders.map(f => f.name).join(', ');
        ui.notifications.info(`No summons folder found for: ${actor.name}. Available summons folders: ${folderNames}`);
      } else {
        ui.notifications.info(`No summons folder found for: ${actor.name}. No summons folders exist in the Actors tab.`);
      }
    }
  }
  
  if (!folder) {
    ui.notifications.warn(`Summons folder for this character not found! Please create a folder named "${actor?.name || 'Character'} Summons" in the Actors tab.`);
    return;
  }
  // Get all actors in the folder
  const actors = folder.contents.filter(a => a.documentName === 'Actor');
  if (!actors.length) {
    ui.notifications.warn(`No creatures found in the summons folder "${folder.name}"! Please add some creatures to this folder.`);
    return;
  }
  // Gather levels and build dropdowns


  // Prepare actors with level and traits info, sort by level descending
  let actorsWithLevel = actors.map(a => {
    let level = a.system?.details?.level?.value ?? a.system?.level ?? '';
    let traits = a.system?.traits?.value || [];
    return { id: a.id, name: a.name, level: Number(level) || 0, traits };
  });
  actorsWithLevel.sort((a, b) => b.level - a.level);

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

  let html = `<form class='summon-helper-form' style='display:flex;flex-direction:column;'>
    <div style="padding: 8px 0 0 0;">
      <div style="display: flex; align-items: flex-start; gap: 24px;">
        <div style="min-width: 60px;">
          <label style="font-weight:bold;">Level:</label><br>
          <div id='level-list' style="display: flex; flex-direction: column; gap: 2px; margin-top: 2px; max-height: 242px; overflow-y: auto;">
            <div class="summon-level-option" data-level="">All</div>
            ${levelOptions}
          </div>
        </div>
        <div style="flex:1;">
          <div style="font-weight:bold; margin-bottom: 2px;">Traits:</div>
          <div id='trait-filters' style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 2px 8px; max-height: 242px; overflow-y: auto; overflow-x: hidden;">
            ${traitCheckboxes}
          </div>
        </div>
      </div>
      <div style="display:flex;gap:12px;margin-top:6px;">
        <button type="button" id="reset-level-btn" style="flex:1;background:#4caf50;color:white;font-weight:bold;border:none;border-radius:4px;padding:2px 0;">Reset Level</button>
        <button type="button" id="reset-traits-btn" style="flex:1;background:#4caf50;color:white;font-weight:bold;border:none;border-radius:4px;padding:2px 0;">Reset Traits</button>
      </div>
    </div>
    <br>
    <div style="display:flex;align-items:center;margin-bottom:2px;gap:40px;">
      <label style="margin:0;">Choose a creature:</label>
      <label style="display:flex;align-items:center;gap:4px;font-weight:normal;font-size:13px;margin-left:auto;">
        Place template for 10s?<input type="checkbox" id="place-template-checkbox"> 
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
          .summon-helper-form { height: 100%; min-height: 320px; }
          #trait-filters label { display: flex; align-items: center; gap: 4px; font-size: 13px; padding: 2px 0; }
          #trait-filters { margin-bottom: 2px; }
          #summon-list { max-height: 176px !important; padding: 0 !important; }
        `;
        document.head.appendChild(style);
      }
      // Ensure the dialog auto-sizes to content and doesn't overflow
      const $dialog = html.closest('.app.window-app');
      if ($dialog.length) {
        $dialog.css({ width: 'auto', 'max-width': '600px', 'min-width': '340px' });
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
        // Get selected levels from .summon-level-option.selected
        const selectedLevelDivs = html.find('.summon-level-option.selected');
        let selectedLevels = selectedLevelDivs.map(function() {
          const lvl = $(this).data('level');
          return lvl === '' ? null : Number(lvl);
        }).get().filter(lvl => lvl !== null);
        // If All is selected or none, show all
        const filterByLevel = selectedLevels.length > 0;
        const selectedTraits = html.find('.trait-filter:checked').map(function() { return this.value; }).get();
        let filtered = allCreatureOptions.filter(function(opt) {
          const creatureLevel = Number($(opt).data('level'));
          const creatureTraits = ($(opt).data('traits') || '').split(',').filter(Boolean);
          // Level filter
          if (filterByLevel && !selectedLevels.includes(creatureLevel)) return false;
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
        const $this = $(this);
        const isAll = $this.data('level') === '';
        if (isAll) {
          html.find('.summon-level-option').removeClass('selected');
          $this.addClass('selected');
        } else {
          const $all = html.find('.summon-level-option[data-level=""]');
          $all.removeClass('selected');
          $this.toggleClass('selected');
          // If none selected, select All
          if (html.find('.summon-level-option.selected').length === 0) {
            $all.addClass('selected');
          }
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

      // Add Reset Level and Reset Traits button logic
      html.find('#reset-level-btn').on('click', function() {
        html.find('.summon-level-option').removeClass('selected');
        html.find('.summon-level-option[data-level=""]').addClass('selected');
        filterCreatures();
      });
      html.find('#reset-traits-btn').on('click', function() {
        html.find('.trait-filter').prop('checked', false);
        filterCreatures();
      });

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
              const created = await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [templateData]);
              if (created && created.length > 0) {
                const templateId = created[0].id;
                setTimeout(() => {
                  canvas.scene.deleteEmbeddedDocuments("MeasuredTemplate", [templateId]);
                }, 10000);
              }
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
  // (Removed duplicate style injection that could affect chat window size)
    }
  });
  d.render(true);
}
