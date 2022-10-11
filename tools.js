const { stat } = require("fs");
const { factionTypes, staticItems, templates, baseAbilities, regionExpeditionNote, equipmentPerkDescriptions } = require("./data.json");

function weightedRandom(choices){
    let entries = []

    let current = 0;

    for(choice of choices){
        entries.push({
            lowBound:current,
            highBound:current + choice.chance,
            obj:choice.obj
        })
        current += choice.chance
    }

    let num = Math.floor(Math.random() * current)

    let selected;
    for(entry of entries){
        if(num >= entry.lowBound && num < entry.highBound){
            selected = entry.obj
            break;
        }
    }
    return selected
}

function calculateEffectCost(e){
    let Eval = 0;
    switch(parseInt(e.target)){
        case 0:
            Eval = 1;
            break;

         case 1:
            Eval = 1.5;
            break;

        case 2:
            Eval = -1.5;
            break;

        case 3:
            Eval = -2;
            break;

        case 4:
            Eval = -3;
            break;
    }
    if(e.stat == "spd"){
        Eval *= 0.75
    } else if(["atk","spatk"].includes(e.stat)){
        Eval *= 0.9
    }
    let allyTargets = ["0","1"]
    let enemyTargets = ["2","3"]
    if(e.value > 0){
        if(enemyTargets.includes(e.target)){
            Eval *= (0.2 * e.value)
        } else {
            Eval *=  e.value
        }
    } else {
        if(allyTargets.includes(e.target)){
            Eval *= (0.2 * e.value)
        } else {
            Eval *=  e.value
        }
    }
    return Eval * 30;
}

function calculateAbilityCost(ability){
    let value = 0
    switch(ability.action_type){
        case "attack":
            value = ability.damage_val

            value *= {
                0:0.9,
                1:1,
                2:1.2,
                4:1.6
            }[ability.speed]

            if(ability.numHits >  1){
                value *= ability.numHits * 1.125
            } else {
                value *= ability.numHits 
            }

            value *= 1 + (ability.critical/100)

            value *= 1 - (0.9 * (ability.recoil/100))

            value *= {
                1:1,
                2:3,
                3:2.5
            }[ability.targetType]

            if(ability.accuracy <= 100){
                value *= (ability.accuracy/100)
            } else {
                value *= (((ability.accuracy - 90)/10) * 0.35)
            }
            break
        case "guard":
            value = (ability.guard_val * 1.625) + ability.counter_val
            value *= 1 + 0.45 * (Math.log(parseInt(ability.success_level)/25)/Math.log(2) - 2)
            break;

        case "stats":
            value = 0;
            for(e of ability.effects){
                value += calculateEffectCost(e)
            }
            value *= {
                0:0.9,
                1:1,
                2:1.2,
                4:1.6
            }[ability.speed]
            break;
    }
    return Math.ceil(value);
}

function msToTime(s) {
    if(s > 0){ 
        var ms = s % 1000;
        s = (s - ms) / 1000;
        var secs = s % 60;
        s = (s - secs) / 60;
        var mins = s % 60;
        var hrs = (s - mins) / 60;
    
        let final = ""
        if(hrs > 0)
            final += hrs + 'h '

        if(mins > 0)
            final += mins + 'm '

        if(secs > 0)
            final += secs + 's'
            
        return final;
    } else {
        return "a few moments"
    }
    
}

function clone(obj){
    return JSON.parse(JSON.stringify(obj))
}

function levelPlayer(player){
    player.level++;
    player.statpoints += 6;
    player.abilitypoints += 6;
    player.exp -= player.expCap
    player.expCap = player.level * 100
    return player
}

function levelTown(town){
    let foodCheck = town.resources.food[0] >= town.resources.food[1]
    let woodCheck = town.resources.wood[0] >= town.resources.wood[1]   
    let mineralsCheck = town.resources.minerals[0] >= town.resources.minerals[1]
    let resourceCheck = foodCheck && woodCheck && mineralsCheck
    if(resourceCheck && town.dungeonClear && town.points >= town.level * 10){
        town.resources.food[0] -= town.resources.food[1]
        town.resources.wood[0] -= town.resources.wood[1]
        town.resources.minerals[0] -= town.resources.minerals[1]
        town.resources.food[1] *= 2
        town.resources.wood[1] *= 2
        town.resources.minerals[1] *= 2
        town.level++
        town.dungeonClear = false
    }
    return town
}

function generateRNGEquipment(dropData,SP){
    let rngSet = dropData.ref.rngEquipment
    let equipmentData = clone(templates.emptyEquipmentData)
    equipmentData.type = rngSet.types[Math.floor(Math.random() * rngSet.types.length)]

    let val = rngSet.baseVal

    if(rngSet.scaling){
        val = SP * 6
    }
    val = Math.ceil(val * rngSet.value)
    
    let conVal = -Math.ceil(val * rngSet.conValue)
    val += Math.ceil((Math.abs(conVal) / 2))

    let valMax = val;
    let conValMax = Math.abs(conVal)

    while(val > 0 || conVal < 0){
        let attributeArray = []
        let current = null;
        if(val > 6){
            if(Math.random() < 0.6){
                attributeArray = attributeArray.concat(["perk_","perk_"])
                current = ["perk"]
            }
        } 
        if(current == null){
            if(rngSet.lockStatTypes){
                switch(equipmentData.type){
                    case "weapon":
                        attributeArray = attributeArray.concat(["stat_atk","stat_spatk","stat_spd"])
                        break;

                    case "gear":
                        attributeArray = attributeArray.concat(["stat_def","stat_spdef","stat_hp"])
                        break;
                }
            } else {
                attributeArray = attributeArray.concat(["stat_atk","stat_spatk","stat_spd","stat_def","stat_spdef","stat_hp"])
            }
            attributeArray = arrayShuffle(attributeArray)
            current = attributeArray[0].split("_")
        }

    
        
        switch(current[0]){
            case "stat":
                if(conVal < 0){
                    let amount = Math.ceil(Math.random() * Math.abs(conVal))
                    while(amount > Math.ceil(conValMax * 0.25)){
                        amount = Math.ceil(Math.random() * Math.abs(conVal))
                    }
                    conVal += amount
                    equipmentData.stats[current[1]] -= amount;     
                } else if(val > 0){
                    let amount = Math.ceil(Math.random() * val)
                    while(amount > Math.ceil(valMax * 0.25)){
                        amount = Math.ceil(Math.random() * val)
                    }
                    val -= amount
                    equipmentData.stats[current[1]] += amount;     
                }
                break;
            
            case "perk":
                let index = Math.floor(Math.random() * 6)
                if(equipmentData.typePerks[index] < 5){
                    val -= 6
                    equipmentData.typePerks[index]++
                }
                break;
        }
    }
    return equipmentData
}   

function stringShuffle(string) {
    var a = string.split(""),
        n = a.length;

    for(var i = n - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = a[i];
        a[i] = a[j];
        a[j] = tmp;
    }
    return a.join("");
}

function arrayShuffle(array){
    let currentIndex = array.length,  randomIndex;
        
        // While there remain elements to shuffle.
        while (currentIndex != 0) {
        
            // Pick a remaining element.
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;
        
            // And swap it with the current element.
            [array[currentIndex], array[randomIndex]] = [
            array[randomIndex], array[currentIndex]];
        }
        
        return array;
}

function givePlayerItem(item,player){
    if(!player.inventory)
        player.inventory = []

    switch(item.type){
        case "weapon":
            player.inventory.push(item)
            break;
        
        case "gear":
            player.inventory.push(item)
            break;

        case "loot":
            let added = false;
            for(eItem of player.inventory){
                if(eItem.id != undefined){
                    if(item.id == eItem.id){
                        eItem.count++;
                        added = true
                    }
                }
            }
            if(!added){
                player.inventory.push(item)
            }
            break;
    }
    return player;
}

function generateRNGAbility(abilityData,abilityBase){
    let actionType = ["attack","guard","stats"][Math.floor(Math.random() * 3)]
    if(abilityData.forceType){
        actionType = abilityData.forceType
    }
    let typeValues;
    let newAbility;

    switch(actionType){
        case "attack":
            typeValues = [
                ["critical",[0,100,5],"inc"],
                ["damage_val",[10,100,5],"inc"],
                ["numHits",[1,6,1],"inc"],
                ["recoil",[0,100,5],"inc",true],
                ["targetType",["1","2","3"],"val"],
                ["accuracy",[10,130,10],"inc"],
                ["speed",[0,1,2,4],"val"]
            ]
            newAbility = clone(templates.attack)
            newAbility.damage_type = ["atk","spatk"][Math.floor(Math.random() * 2)]
            newAbility.speed = 1
            break;

        case "guard":
            typeValues = [
                ["guard_val",[10,100,5],"inc"],
                ["counter_val",[0,100,5],"inc"],
                ["success_level",["25","50","100","200","400"],"val"]
            ]
            newAbility = clone(templates.guard)
            newAbility.guard_type = ["def","spdef"][Math.floor(Math.random() * 2)]
            newAbility.counter_type = newAbility.guard_type
            newAbility.speed = 3
            newAbility.success_level = "100"
            break;

        case "stats":
            newAbility = clone(templates.stats)
            newAbility.statChangeCount = Math.ceil(Math.random() * 3)
            newAbility.effects = []
            newAbility.speed = [0,1,2,4][Math.floor(Math.random() * 4)]
            for(var i = 0;i < newAbility.statChangeCount; i++){
                let newEffect = clone(templates.stats.effects[0])
                newEffect.value = 0;
                newEffect.target = "0"
                newEffect.stat = ["atk","spatk","def","spdef","spd"][Math.floor(Math.random() * 5)]
                if(newAbility.effects.length > 1){
                    let repeatStat 
                    do{
                        repeatStat = false
                        for(var x = 0;x < newAbility.effects.length; x++){
                            if(newAbility.effects[x].stat == newEffect.stat){
                                repeatStat = true
                                newEffect.stat = ["atk","spatk","def","spdef","spd"][Math.floor(Math.random() * 5)]
                                break;
                            }
                        }
                    }while(repeatStat)
                }
                newAbility.effects.push(newEffect)
            }
            break;
    }

    let cost = calculateAbilityCost(newAbility)
    let lastChange;

    while(cost <= abilityData.baseVal){
        if(newAbility.action_type == "stats"){
            if(abilityData.conSteps > 0){
                let hasNegative = false;
                for(e of newAbility.effects){
                    if(calculateEffectCost(e) < 0){
                        hasNegative = true
                        break;
                    }
                }
                if(!hasNegative && newAbility.effects.length < 3){
                    let newEffect = clone(templates.stats.effects[0])
                    newEffect.target = ["0","1","2","3","4"][Math.floor(Math.random() * 5)]
                    if(["0","1"].includes(newEffect.target)){
                        newEffect.value = -1
                    } else {
                        newEffect.value = 1
                    }
                    newEffect.stat = ["atk","spatk","def","spdef","spd"][Math.floor(Math.random() * 5)]
                    if(newAbility.effects.length > 1){
                        newEffect.value = 0
                        let repeatStat 
                        do{
                            repeatStat = false
                            for(var x = 0;x < newAbility.effects.length; x++){
                                if(newAbility.effects[x].stat == newEffect.stat){
                                    repeatStat = true
                                    newEffect.stat = ["atk","spatk","def","spdef","spd"][Math.floor(Math.random() * 5)]
                                    break;
                                }
                            }
                        }while(repeatStat)
                    }
                    newAbility.effects.push(newEffect)
                    abilityData.conSteps--
                } else {
                    let currentEffect = newAbility.effects[Math.floor(Math.random() * newAbility.effects.length)]
                    if(["0","1"].includes(currentEffect.target)){
                        currentEffect.value -= 1
                        if(currentEffect.value < -4){
                            currentEffect.value = -4;
                        } else {
                            abilityData.conSteps--
                        }
                    } else {
                        currentEffect.value += 1
                        if(currentEffect.value > 4){
                            currentEffect.value = 4;
                        } else {
                            abilityData.conSteps--
                        }
                    }
                }
            } else {
                let currentEffect;
                switch(Math.floor(Math.random() * 3)){
                    case 0:
                        currentEffect = newAbility.effects[Math.floor(Math.random() * newAbility.effects.length)]
                        if(["0","1"].includes(currentEffect.target)){
                            currentEffect.value += 1
                            if(currentEffect.value > 4){
                                currentEffect.value = 4;
                            }
                        } else {
                            currentEffect.value -= 1
                            if(currentEffect.value < -4){
                                currentEffect.value = -4;
                            }
                        }
                        break;

                    case 1:
                        currentEffect = newAbility.effects[Math.floor(Math.random() * newAbility.effects.length)]
                        if(calculateEffectCost(currentEffect) > 0){
                            if(["0","1"].includes(currentEffect.target)){
                                if(currentEffect.target == "0"){
                                    currentEffect.target = "1"
                                }
                            } else {
                                if(currentEffect.target != "4"){
                                    currentEffect.target = "" + (parseInt(currentEffect.target) + 1)
                                }
                            }
                        }
                        break;

                    case 2:
                        if(newAbility.effects.length < 3){
                            let newEffect = clone(templates.stats.effects[0])
                            newEffect.target = ["0","1","2","3","4"][Math.floor(Math.random() * 5)]
                            if(["0","1"].includes(newEffect.target)){
                                newEffect.value = (1  + Math.floor(Math.random() * 2))
                            } else {
                                newEffect.value = -(1  + Math.floor(Math.random() * 2))
                            }
                            newEffect.stat = ["atk","spatk","def","spdef","spd"][Math.floor(Math.random() * 5)]
                            if(newAbility.effects.length > 1){
                                newEffect.value = 0
                                let repeatStat;
                                do{
                                    repeatStat = false
                                    for(var x = 0;x < newAbility.effects.length; x++){
                                        if(newAbility.effects[x].stat == newEffect.stat){
                                            repeatStat = true
                                            newEffect.stat = ["atk","spatk","def","spdef","spd"][Math.floor(Math.random() * 5)]
                                            break;
                                        }
                                    }
                                }while(repeatStat)
                            }
                            newAbility.effects.push(newEffect)
                        } 
                        break;
                }
            }
            cost = calculateAbilityCost(newAbility)
        } else {
            let targetStat = typeValues[Math.floor(Math.random() * typeValues.length)]
            if(abilityData.conSteps > 0){
                while(targetStat[2] == "val"){
                    targetStat = typeValues[Math.floor(Math.random() * typeValues.length)]
                } 
            }
            switch(targetStat[2]){
                case "inc":
                    if(abilityData.conSteps > 0){
                        if(targetStat[3]){
                            newAbility[targetStat[0]] += targetStat[1][2]
                        } else {
                            newAbility[targetStat[0]] -= targetStat[1][2]
                        }
                        if(newAbility[targetStat[0]] >= targetStat[1][0]){
                            abilityData.conSteps -= 1
                        }
                    } else {
                        if(targetStat[3]){
                            newAbility[targetStat[0]] -= targetStat[1][2] * Math.ceil(Math.random() * 5)
                        } else {
                            newAbility[targetStat[0]] += targetStat[1][2] * Math.ceil(Math.random() * 5)
                        }
                    }
                    if(newAbility[targetStat[0]] > targetStat[1][1]){
                        newAbility[targetStat[0]] = targetStat[1][1]
                    }
                    if(newAbility[targetStat[0]] < targetStat[1][0]){
                        newAbility[targetStat[0]] = targetStat[1][0]
                    }
                    break;

                case "val":
                    if(abilityData.conSteps == 0){
                        if(targetStat[1].indexOf(newAbility[targetStat[0]]) < targetStat[1].length - 1){
                            newAbility[targetStat[0]] = targetStat[1][targetStat[1].indexOf(newAbility[targetStat[0]]) + 1]
                        }
                    } else {
                        if(targetStat[1].indexOf(newAbility[targetStat[0]]) > 0){
                            newAbility[targetStat[0]] = targetStat[1][targetStat[1].indexOf(newAbility[targetStat[0]]) - 1]
                        }
                    }
                    break;
            }
            lastChange = [targetStat[0],newAbility[targetStat[0]]]
            if(abilityData.forceStats != false){
                for(stat of abilityData.forceStats){
                    newAbility[stat[0]] = stat[1] 
                }
            }
            cost = calculateAbilityCost(newAbility)
        }
    }

    if(cost > abilityData.baseVal){
        if(newAbility.action_type != "stats"){
            while(cost > abilityData.baseVal){
                let targetStat = typeValues[Math.floor(Math.random() * typeValues.length)]
                while(targetStat[2] == "val"){
                    targetStat = typeValues[Math.floor(Math.random() * typeValues.length)]
                }
                if(targetStat[3]){
                    newAbility[targetStat[0]] += targetStat[1][2]
                } else {
                    newAbility[targetStat[0]] -= targetStat[1][2]
                }
                if(newAbility[targetStat[0]] < targetStat[1][0]){
                    newAbility[targetStat[0]] = targetStat[1][0]
                }
                lastChange = [targetStat[0],newAbility[targetStat[0]]]
                cost = calculateAbilityCost(newAbility)
            }
        } else {
            while(cost > abilityData.baseVal && cost < 0){
                if(Math.random() > 0.25){
                    let currentEffect = newAbility.effects[Math.floor(Math.random() * newAbility.effects.length)]
                    if(["0","1"].includes(currentEffect.target)){
                        currentEffect.value -= 1
                        if(currentEffect.value < -4){
                            currentEffect.value = -4;
                        }
                    } else {
                        currentEffect.value += 1
                        if(currentEffect.value > 4){
                            currentEffect.value = 4;
                        }
                    }
                    cost = calculateAbilityCost(newAbility)
                } else {
                    currentEffect = newAbility.effects[Math.floor(Math.random() * newAbility.effects.length)]
                    if(calculateEffectCost(currentEffect) > 0){
                        if(["0","1"].includes(currentEffect.target)){
                            if(currentEffect.target == "1"){
                                currentEffect.target = "0"
                            }
                        } else {
                            if(currentEffect.target != "2"){
                                currentEffect.target = "" + (parseInt(currentEffect.target) - 1)
                            }
                        }
                    }
                    break;
                }
            }
        }
    }

    if(newAbility.action_type == "stats"){
        for(let i = 0; i < newAbility.effects.length; i ++){
            if(newAbility.effects[i].value == 0){
                newAbility.effects.splice(i,1)
                i--
            }
        }
        newAbility.statChangeCount = newAbility.effects.length
    }
    return newAbility
}

function addAdditionals(string,additionals){
    if(additionals.length != 0){
        string += "Additionally this ability"
        for(var i =0;i < additionals.length;i++){
            let info = additionals[i]
            if(i == additionals.length - 1 && additionals.length != 1){
                info = " and" + info
            }
            string += info
            if(i != additionals.length - 1 && additionals.length > 2){
                string += ","
            } 
        }
        string += "."
    }
    return string
}

function createAbilityDescription(ability){
    let desc = ""
    let additionals = [];
    switch(ability.action_type){
        case "attack":
            if(parseInt(ability.faction) != -1){
                desc += "-Alignment : " + factionTypes[ability.faction].name +"-\n"
            }
            desc += "The user attacks " + {
                "1":"it's target",
                "2":"all enemies",
                "3":"everyone else"
            }[ability.targetType]
            if(ability.numHits != 1){
                desc += " " + ability.numHits + " times"
            }
            desc += " with a base damage of " + ability.damage_val + ", "
            desc += "increased by users " + ability.damage_type + " stat and decreased by target's " + (ability.damage_type == "atk" ? "def" : "spdef") + " stat. "
            dditionals = []
            if(ability.critical > 0){
                additionals.push(" has a " + ability.critical + "% chance to critically hit")
            }
            if(ability.recoil > 0){
                additionals.push(" deals " + ability.recoil + "% of damage dealt as recoil to the user")
            }
            if(ability.speed != 1){
                let speedRating = ""
                switch(ability.speed){
                    case 0:
                        speedRating = " is slower than most other actions"
                        break;
                    
                    case 2:
                        speedRating =" is faster than the average attack"
                        break;
                        
                    case 4:
                        speedRating = " will land before an opponent has the chance to guard themselves"
                        break;
                }
                additionals.push(speedRating)
            }
            if(ability.accuracy != 100){
                if(ability.accuracy > 100){
                    let secureHits = (ability.accuracy - 100)/10
                    additionals.push(" can be used " + secureHits + " times before becoming inaccurate")
                } else {
                    additionals.push(" has a " + ability.accuracy + "% chance to land")
                }
            }
            desc = addAdditionals(desc,additionals)
            break;
        case "guard":
            desc += "The user lowers the base damage of an incoming " + {
                "def":"atk",
                "spdef":"spatk"
            }[ability.guard_type] + " based ability by " + ability.guard_val + ". This value is halved if the attack is " + {
                "def":"spatk",
                "spdef":"atk"
            }[ability.guard_type] + " based."
            if(ability.counter_val > 0){
                desc += " If the incoming attack is " + {
                    "def":"atk",
                    "spdef":"spatk"
                }[ability.guard_type] + " based, the user will counter attack with a base damage of " + ability.counter_val + " scaling with the user's " + ability.counter_type + " stat against the attacker's " + ability.counter_type + " stat."

            }
            if(ability.success_level != 100){
                if(ability.success_level > 100){
                    let count = Math.log(ability.success_level/25)/Math.log(2) - 2
                    desc += " Additionally, this ability becomes unreliable after " + count + " consecutive guard abilit" + (count > 1 ? "ies have" : "y has") + " been used."
                } else {
                    desc += " Additionally, this ability has it's rate of success decreased by " + (100 - ability.success_level) + "%."
                }
            }
            break;

        case "stats":
            desc += "The user "
            for(i in ability.effects){
                let effect = ability.effects[i]
                if(effect.value != 0){
                    if(effect.value > 0){
                        desc += "increases"
                    } else {
                        desc += "decreases"
                    }
                    switch(effect.target){
                        case "0":
                            desc += " their "
                            break;
                    
                        case "1":
                            desc += " all allies "
                            break;

                        case "2":
                            desc += " a target's "
                            break;

                        case "3":
                            desc += " all other units "
                            break;

                        case "4":
                            desc += " all enemies "
                            break;
                    }
                    desc += effect.stat + " stat by " + Math.abs(effect.value) + " stage" + (Math.abs(effect.value) > 1 ? "s" : "")
                    if(i < ability.effects.length - 2){
                        desc += ", "
                    } else if(i == ability.effects.length - 2){
                        desc += " and "
                    }
                }
            }
            desc += ". "
            if(ability.speed != 1){
                let speedRating = ""
                switch(ability.speed){
                    case 0:
                        speedRating = " is slower than most other actions"
                        break;
                    
                    case 2:
                        speedRating =" is faster than the average action"
                        break;
                        
                    case 4:
                        speedRating = " will happen before an opponent has the chance to guard themselves"
                        break;
                }
                additionals.push(speedRating)
            }
            desc = addAdditionals(desc,additionals)
            break;
    }
    return desc + "";
}

function clarifyFighterNames(fighters){
    for(i in fighters){
        fighters[i].staticData.name = fighters[i].staticData.name.split(fighters[i].dupeTag)[0]
        delete fighters[i].dupeTag;
    }
    for(i in fighters){
        let dupeIndexes = []
        let f = fighters[i]
        for(x in fighters){
            let f2 = fighters[x]
            if(x != i && f2.staticData.name == f.staticData.name){
                dupeIndexes.push(x)
            }
        }
        dupeIndexes.push(i)
        if(dupeIndexes.length > 1){
            let count = 1
            for(d of dupeIndexes){
                fighters[d].dupeTag = " #" + count
                fighters[d].staticData.name += " #" + count
                count++
            }
        }
    }
}

module.exports = {
    levelTown(town){
        return levelTown(town)
    },
    msToTime(s){
        return msToTime(s)
    },
    calculateAbilityCost(ability){
        return calculateAbilityCost(ability)
    },
    prepCombatFighter(fighter,index){
        let fighterStats = clone(fighter.stats)
        if(fighter.inventory){
            if(fighter.gear){
                let fGear = fighter.inventory[fighter.gear]
                for(s in fGear.stats){
                    if(s == "hp"){
                        fighterStats[s] += fGear.stats[s] * 2
                    } else {
                        fighterStats[s] += fGear.stats[s] 
                    }
                    if(fighterStats[s] < 1){
                        fighterStats[s] = 1
                    }
                }
            }
            if(fighter.weapon){
                let fWeapon = fighter.inventory[fighter.weapon]
                for(s in fWeapon.stats){
                    if(s == "hp"){
                        fighterStats[s] += fWeapon.stats[s] * 2
                    } else {
                        fighterStats[s] += fWeapon.stats[s] 
                    }
                    if(fighterStats[s] < 1){
                        fighterStats[s] = 1
                    }
                }
            }
        }
        let fighterData = {
            alive:true,
            forfeit:false,
            index:index,
            staticData:fighter,
            liveData:{
                stats:fighterStats,
                statChanges:{
                    atk:2,
                    spatk:2,
                    def:2,
                    spdef:2,
                    spd:2
                },
                healing:0,
                maxhp:fighterStats.hp
            },
            records:{
                timesBlocked:0,
                timesHit:0,
                attacks:0,
                guards:0,
                spattacks:0,
                spguards:0,
                statChanges:0,
                weaponsLooted:0,
                gearLooted:0,
                raresDefeated:0,
                enemyDamageTaken:0,
                attackDamageDone:0,
                baseDamageBlocked:0,
                counterDamageDone:0,
                recoilDamageTaken:0,
                unitsDefeated:0,
                criticalsLanded:0,
                completeBlocks:0,
                timesStatsLowered:0,
                timesStatsRaised:0,
                timesFirstAttack:0,
                timesAbilityRepeat:0
            },
            choosenAbility:-1,
            target:-1,
            repeats:0,
            hasActed:false,
            lastAction:"",
            guardData:"none"
        }
        if(fighter.boosters){
            let now = new Date();
            for(b of fighter.boosters){
                if(b.expire > now.getTime()){
                    switch(b.type){
                        case "speed":
                            fighterData.liveData.statChanges.spd += b.value
                            break;

                        case "attack":
                            fighterData.liveData.statChanges.atk += b.value
                            break;

                        case "defense":
                            fighterData.liveData.statChanges.def += b.value
                            break;

                        case "spattack":
                            fighterData.liveData.statChanges.spatk += b.value
                            break;

                        case "spdefense":
                            fighterData.liveData.statChanges.spdef += b.value
                            break;

                        case "healing":
                            let stats = ["atk","spatk","def","spdef","spd"]
                            fighterData.liveData.statChanges[Math.floor(Math.random() * stats.length)] += b.value - 1
                            break;
                    }
                }
            }
        }
        return fighterData
    },
    weightedRandom(choices){
        return weightedRandom(choices)
    },
    arrayShuffle(array) {
        return arrayShuffle(array)
    },
    clone(obj){
        return clone(obj)
    },
    runEnemyCombatAI(fighters){
        clarifyFighterNames(fighters)
        for(var i = 0; i < fighters.length;i++){
            let fighter = fighters[i]
            if(fighter.staticData.cpu && fighter.alive){
                if(fighter.staticData.abilities){
                    if(fighter.staticData.abilities.length > 0){
                        let selectAbility = true
                        while(selectAbility){
                            let nextAction;
                            fighter.choosenAbility = (Math.floor(Math.random() * fighter.staticData.abilities.length)).toString()
                            let abilityData = fighter.staticData.abilities[fighter.choosenAbility]
                            switch(abilityData.action_type){
                                case "attack":
                                    if(fighters.length == 2){
                                        fighter.target = [1,0][fighter.index]
                                    } else {
                                        if(fighter.team != null){
                                            let targetI = Math.floor(Math.random() * fighters.length)
                                            while(targetI == fighter.index || fighters[targetI].team == fighter.team || fighters[targetI].alive == false){
                                                targetI = Math.floor(Math.random() * fighters.length)
                                            }
                                            fighter.target = targetI
                                        } else {
                                            let targetI = Math.floor(Math.random() * fighters.length)
                                            while(targetI == fighter.index || fighters[targetI].alive == false){
                                                targetI = Math.floor(Math.random() * fighters.length)
                                            }
                                            fighter.target = targetI
                                        }
                                    }
                                    nextAction = fighter.index + "_" + abilityData.name + "_" + fighters[fighter.target]
                                    break;

                                case "guard":
                                    nextAction = fighter.index + "_" + abilityData.action_type
                                    break;
                            }
                            if(nextAction == fighter.lastAction && fighter.staticData.intelligence){
                                selectAbility = fighter.staticData.intelligence.reuse < Math.random()
                            } else {
                                selectAbility = false
                            }
                        }
                    }
                }
            }
        }
    },
    createAbilityDescription(ability){
        return createAbilityDescription(ability)
    },
    printEquipmentDisplay(item){
        let zeroStats = true;
        let data = ""
        data += item.name + "\n"
        switch(item.type){
            case "weapon":
                data += "Type: " + ["Melee","Ranged","Spell-Casting","Rune"][item.weaponStyle] +"\n\n"
                for(s in item.stats){
                    let val = item.stats[s]
                    if(s == "hp"){
                        val *= 2
                    }
                    if(val > 0){
                        zeroStats = false
                        data += "+" + val + " " + s + "\n"
                    } else if (val < 0){
                        zeroStats = false
                        data += val + " " + s + "\n"
                    }
                }
                data += "\n"
                let noWeaponPerks = true
                for(p in item.typePerks){
                    let val = item.typePerks[p]
                    if(val > 0){
                        noWeaponPerks = false;
                        data += "\n> " + equipmentPerkDescriptions.weapon[p][0].replace("X",equipmentPerkDescriptions.weapon[p][1] * val) + "\n"
                    }
                }
                if(zeroStats){
                    data += "---No Stat Changes---\n"
                }
                if(noWeaponPerks){
                    data += "---No Weapon Perks---\n"
                }
                break;

            case "gear":
                data += "Type: Gear\n\n"
                for(s in item.stats){
                    let val = item.stats[s]
                    if(s == "hp"){
                        val *= 2
                    }
                    if(val > 0){
                        zeroStats = false
                        data += "+" + val + " " + s + "\n"
                    } else if (val < 0){
                        zeroStats = false
                        data += val + " " + s + "\n"
                    }
                }
                let nogearPerks = true
                for(p in item.typePerks){
                    let val = item.typePerks[p]
                    if(val > 0){
                        nogearPerks = false;
                        data += "\n> " + equipmentPerkDescriptions.gear[p][0].replace("X",equipmentPerkDescriptions.gear[p][1] * val) + "\n"
                    }
                }
                if(zeroStats){
                    data += "---No Stat Changes---\n"
                }
                if(nogearPerks){
                    data += "---No Gear Perks---\n"
                }
                break;

            case "loot":
                data += "Type: Loot\n\n"
                data += "Count: " + item.count + "\n"
                data += "Value: " + item.value + "\n"

        }
        return data
    },
    levelPlayer(player){
        return levelPlayer(player)
    },
    givePlayerItem(item,player){
        return givePlayerItem(item,player)
    },
    removePlayerItem(index,player,amount){
        if(player.inventory[i].count){
            player.inventory[i].count -= amount
            if(player.inventory[i].count <= 0){
                player.inventory.splice(index,1)
            }
        } else {
            player.inventory.splice(index,1)
        }
        if(parseInt(player.gear) > index){
            player.gear--;
        }
        if(parseInt(player.weapon) > index){
            player.weapon--;
        }
        if(parseInt(player.gear) == index){
            player.gear = null;
        }
        if(parseInt(player.weapon) == index){
            player.weapon = null;
        }
        return player;
    },
    simulateCPUAbilityAssign(unit,innateAbilities,allowance){
        let abilityDict = {}
        let highestCost = 0;
        for(ability of baseAbilities){
            if(ability.wildUse){
                if(!abilityDict[ability.allowanceCost]){
                    abilityDict[ability.allowanceCost] = []
                }
                if(ability.allowanceCost > highestCost){
                    highestCost = ability.allowanceCost
                }
                abilityDict[ability.allowanceCost].push(ability)
            }
        }
        if(innateAbilities){
            for(i of innateAbilities){
                unit.abilities.push(baseAbilities[i].ability)
                allowance -= baseAbilities[i].allowanceCost
            }
        }
        
        

        while(allowance > 0 && unit.abilities.length < 6){
            let lastType; 
            if(unit.abilities.length > 0){
                lastType = unit.abilities[unit.abilities.length - 1].action_type
            } else {
                unit.abilities = []
                lastType = ["attack","guard","stats"][Math.floor(Math.random() * 3)]
            }
            let desiredSpend = Math.ceil(Math.random() * highestCost)
            if(abilityDict[desiredSpend]){
                let catalouge = clone(abilityDict[desiredSpend])
                let chosen;
                do {
                    let x = Math.floor(Math.random() * catalouge.length)
                    chosen = catalouge[x]
                    catalouge.splice(x,1)
                } while(chosen.ability.action_type == lastType && catalouge.length > 0)
                if(!(catalouge.length == 0 && chosen.ability.action_type == lastType)){
                    unit.abilities.push(chosen.ability)
                    allowance -= chosen.allowanceCost
                }
            }
        }
        return unit
    },
    simulateCPUSPAssign(unit,points,unitScalar){
        let stats = arrayShuffle(["hp","atk","def","spatk","spdef","spd"])
        let statTotal = 0
        let pointsMax = points
        while(points > 0){
            for(var i = 0; i < stats.length; i++){
                let toSpend = Math.ceil(Math.random() * points) 
                while(toSpend > Math.ceil(pointsMax * 0.25)){
                    toSpend = Math.ceil(Math.random() * points) 
                }
                if(unitScalar){
                    toSpend = Math.ceil(toSpend * unitScalar[stats[i]])
                }
                if(stats[i] == "hp"){
                    unit.stats[stats[i]] += toSpend * 2
                } else {
                    unit.stats[stats[i]] += toSpend
                }
                unit.stats[stats[i]] = Math.floor(unit.stats[stats[i]])
                points -= toSpend
            }
        }   
        for(var i = 0; i < stats.length; i++){
            if(stats[i] == "hp"){
                statTotal += (unit.stats[stats[i]] - 20)/2
            } else {
                statTotal += unit.stats[stats[i]] - 10
            }
        }
        if(unit.level == 0){
            if(Math.ceil(statTotal/6) < 1){
                unit.level = 1
            } else {
                unit.level = Math.floor(statTotal/6)
            }
        }
        return unit
    },
    parseReward(drop,player,mob){
        let messages = []
        if(drop.nothing)
            return [player,messages];


        if(drop.ref){
            switch(drop.ref.type){
                case "rngEquipment":
                    drop = generateRNGEquipment(drop,mob.staticData.level)
                    break;

                case "staticItemID":
                    drop = staticItems[drop.ref.staticItemID]
                    break;
            }
        }


        switch(drop.type){
            case "weapon":
                player = givePlayerItem(drop,player)
                messages.push(player.name + " recieved: " + drop.name + "!")
                break;

            case "gear":
                player = givePlayerItem(drop,player)
                messages.push(player.name + " recieved: " + drop.name + "!")
                break;

            case "loot":
                player = givePlayerItem(drop,player)
                messages.push(player.name + " recieved: " + drop.name + "!")
                break;

            case "resource":
                messages.push(player.name + " recieved " + drop.amount + " " + drop.resourceName + "!")
                switch(drop.resource){
                    case "exp":
                        player.exp += drop.amount;
                        player.totalExp += drop.amount
                        let prevLevel = player.level
                        while(player.exp >= player.expCap){
                            player = levelPlayer(player)
                        }
                        if(player.level > prevLevel){
                            messages.push(player.name + " is now level " + player.level + "!")
                        }
                        break;

                    default:
                        player[drop.resource] += drop.amount
                        break;
                }
                break;
        }

        return [player,messages,drop];
    },
    generateRNGEquipment(dropData,SP){
        return generateRNGEquipment(dropData,SP)
    },
    generateRNGAbility(abilityData,abilityBase){
        return generateRNGAbility(abilityData,abilityBase)
    },
    runExpeditionStep(data,wasActive,town,player){
        data.status.lastCheckIn++
        let index = data.status.lastCheckIn
        data.status.checkIns[index] = wasActive
        if(index == 2){
            let val = 1
            for(x of data.status.checkIns){
                if(x){
                    val++
                }
            }
            val = Math.ceil(Math.random() * val)
            let messageList = regionExpeditionNote[town.regions[Math.floor(Math.random() * 2)]][data.status.type]
            let message = messageList[Math.floor(Math.random() * messageList.length)]
            switch(data.status.type){
                //resource bundle
                case 0:
                    let resource = ["wood","food","minerals"][Math.floor(Math.random() * 3)]
                    let amount = val * 2
                    data.townResources[resource] += amount
                    break;
                
                //gold
                case 1:
                    player.gold += 5 * val
                    break;

                //exp
                case 2:
                    let stat = ["hp","atk","spatk","spdef","def","spd"][Math.floor(Math.random() * 6)]
                    player.stats[stat] += val
                    break; 

                //equipment
                case 3:
                    let newData = {
                        ref:{
                            type: "rngEquipment",
                            rngEquipment: {
                                scaling: false,
                                value:1,
                                conValue:0,
                                lockStatTypes: true,
                                baseVal: 20 * val,
                                types: ["weapon","gear"]
                            }
                        }
                    }
                    let item = generateRNGEquipment(newData)
                    player = givePlayerItem(item,player)
                    break;
                
                //abilitypoints
                case 4:
                    player.abilitypoints += val
                    break;
            }

            data.status = {
                lastCheckIn: -1,
                checkIns:[-1,-1,-1],
                type: weightedRandom([
                    {
                        chance:50,
                        obj:0
                    },
                    {
                        chance:15,
                        obj:1
                    },
                    {
                        chance:15,
                        obj:2
                    },
                    {
                        chance:10,
                        obj:3
                    },
                    {
                        chance:10,
                        obj:4
                    }
                ])
            }
            return [message,player];
        }
    },
    generateDungeon(data){

    }
}