const fs = require('fs');
let inData = require('../data.json')

let creatureData = require('./creatures.json')

for(c in creatureData){
    let creature = creatureData[c]
    for(ability of inData.baseAbilities){
        if(ability.ability.name == creature.ability){
            delete creature.ability
            creature.innateAbilities = [ability.id]
            break;
        }
    }
    creature.id = parseInt(c)
}
inData.creatures = creatureData

let data = JSON.stringify(inData,null,2);
fs.writeFileSync('../data.json', data);