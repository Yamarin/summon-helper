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
      // Draw a measurement circle template on the caster's token with the spell's range
      if (range && actor) {
        // Try to extract a number from the range string (e.g., "30 feet" -> 30)
        let distance = null;
        if (typeof range === 'number') {
          distance = range;
        } else if (typeof range === 'string') {
          const match = range.match(/(\d+)/);
          if (match) distance = parseInt(match[1], 10);
        }
        if (Number.isFinite(distance)) {
          // Find the caster's token on the canvas
          const casterToken = canvas.tokens.placeables.find(t => t.actor?.id === actor.id);
          if (casterToken) {
            // Create a circle template
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
      // Try to extract summonable trait(s) from the spell
      let summonTraits = [];
      if (spellItem && spellItem.system?.traits?.value) {
        // Exclude generic spell traits
        const genericTraits = ["attack","cantrip","concentrate","conjuration","consecration","curse","darkness","death","disease","divination","downtime","dream","earth","electricity","emotion","enchantment","exploration","fear","fire","fortune","healing","incapacitation","incorporeal","light","linguistic","manipulate","mental","metamagic","misfortune","morph","move","nonlethal","plant","poison","polymorph","prediction","rare","scrying","shadow","sleep","scrying","summon","teleportation","tradition","transmutation","uncommon","water","magical","arcane","divine","occult","primal","common","uncommon","rare","unique","ritual","spell" ];
        summonTraits = spellItem.system.traits.value.filter(t => !genericTraits.includes(t));
      }
      showSummonWindow({name: 'Summon Spell', range, summonTraits}, actor);
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

  // Prepare actors with level and trait info, sort by level ascending
  let actorsWithLevel = actors.map(a => {
    let level = a.system?.details?.level?.value ?? a.system?.level ?? '';
    let traits = a.system?.traits?.value ?? [];
    return { id: a.id, name: a.name, level: Number(level) || 0, traits };
  });
  actorsWithLevel.sort((a, b) => a.level - b.level);

  let actorLevels = actorsWithLevel.map(a => a.level).filter(lvl => lvl !== '').map(Number);
  let uniqueLevels = [...new Set(actorLevels)].sort((a, b) => a - b);
  let levelOptions = uniqueLevels.map(lvl => `<option value='${lvl}'>${lvl}</option>`).join('');

  // If summonTraits are provided, filter actorsWithLevel to only those with a matching trait
  let summonTraits = item.summonTraits || [];
  let filteredActors = actorsWithLevel;
  if (summonTraits.length > 0) {
    filteredActors = actorsWithLevel.filter(a => a.traits.some(t => summonTraits.includes(t)));
  }

  // By default, show all (filtered) creatures sorted by level
  let creatureOptions = filteredActors.map(a => {
    return `<option value='${a.id}' data-level='${a.level}'>${a.level ? `LVL${a.level} ` : ''}${a.name}</option>`;
  }).join('');

  let html = `<form>
    ${summonTraits.length > 0 ? `<div><b>Summonable trait:</b> ${summonTraits.join(', ')}</div><br>` : ''}
    <label for='level-select'>Filter by level:</label>
    <select id='level-select'>
      <option value=''>All</option>
      ${levelOptions}
    </select>
    <br><br>
    <label for='summon-select'>Choose a creature:</label>
    <select id='summon-select'>${creatureOptions}</select>
    <br><br>
    <button type='button' id='summon-btn'>Summon this!</button>
  </form>`;
  let d = new Dialog({
    title: 'Summon Creature',
    content: html,
    buttons: {},
    render: html => {
      // Level filter logic
      // Store all creature options for reliable re-filtering
      const allCreatureOptions = html.find('#summon-select option').map(function() {
        return $(this).clone();
      }).get();

      html.find('#level-select').on('change', function() {
        const selectedLevel = Number($(this).val());
        // Filter and sort from the original full list every time
        let filtered = allCreatureOptions.filter(function(opt) {
          const creatureLevel = Number($(opt).data('level'));
          return !selectedLevel || creatureLevel <= selectedLevel;
        });
        filtered = filtered.sort(function(a, b) {
          return Number($(a).data('level')) - Number($(b).data('level'));
        });
        html.find('#summon-select').empty().append(filtered);
        // Select the first visible creature
        const firstVisible = html.find('#summon-select option').first();
        if (firstVisible.length) {
          html.find('#summon-select').val(firstVisible.val());
        }
      });

      html.find('#summon-btn').click(async () => {
        const summonActorId = html.find('#summon-select').val();
        const summonActor = game.actors.get(summonActorId);
        if (!summonActor) return ui.notifications.warn('Actor not found!');
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
    }
  });
  d.render(true);
}
