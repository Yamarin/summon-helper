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
      showSummonWindow({name: 'Summon Spell', range}, actor);
    }
  });
});

async function showSummonWindow(item, actor) {
  // Get the Summons folder
  const folder = game.folders.getName('Summons');
  if (!folder) {
    ui.notifications.warn('Summons folder not found!');
    return;
  }
  // Get all actors in the folder
  const actors = folder.contents.filter(a => a.documentName === 'Actor');
  if (!actors.length) {
    ui.notifications.warn('No creatures found in Summons folder!');
    return;
  }
  // Build dropdown options
  let options = actors.map(a => `<option value='${a.id}'>${a.name}</option>`).join('');
  let html = `<form>
    <label for='summon-select'>Choose a creature:</label>
    <select id='summon-select'>${options}</select>
    <br><br>
    <button type='button' id='summon-btn'>Summon this!</button>
  </form>`;
  let d = new Dialog({
    title: 'Summon Creature',
    content: html,
    buttons: {},
    render: html => {
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
