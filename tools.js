const { stat } = require("fs");
const { off } = require("process");
const { staticItems, templates, baseAbilities, regionExpeditionNote, equipmentPerkDescriptions, nameBank, passiveDescriptions } = require("./data.json");

function simulateCPUStanceAssign(unit){
    if(unit.level < 10){
        return unit;
    } else if((Math.random() * 100) > unit.level * 5){
        return unit;
    }

    let stats = ["hp","atk","def","spatk","spdef","spd"]

    stats.sort(function(a,b){
        if ( unit.stats[a] < unit.stats[b] ){
          return -1;
        }
        if ( unit.stats[a] > unit.stats[b] ){
          return 1;
        }
        return 0;
    });

    stats.reverse()

    unit.stances = clone(templates.emptyPlayerData.stances)
    
    unit.stances[stats[0]].active = true
    unit.stance = stats[0]

    return unit;
}

function parseReward(drop,player,mob){
    let messages = []
    if(drop.nothing)
        return [player,messages];
    if(drop.ref){
        switch(drop.ref.type){
            case "rngEquipment":
                if(mob){
                    drop = generateRNGEquipment(drop,mob.staticData.level)
                } else {
                    drop = generateRNGEquipment(drop)
                }
                break;

            case "staticItemID":
                drop = staticItems[drop.ref.staticItemID]
                break;
        }
    }


    switch(drop.type){
        case "weapon":
            player = givePlayerItem(drop,player)
            messages.push(player.name + " received: " + drop.name + "🗡️")
            break;

        case "gear":
            player = givePlayerItem(drop,player)
            messages.push(player.name + " received: " + drop.name + "🛡️")
            break;

        case "loot":
            player = givePlayerItem(drop,player)
            messages.push(player.name + " received: " + drop.name + "!")
            break;

        case "resource":
            let emoji = ""
            switch(drop.resource){
                case "exp":
                    emoji = "✨"
                    player.exp += drop.amount;
                    player.totalExp += drop.amount
                    let prevLevel = player.level
                    let statIncreases;
                    while(player.exp >= player.expCap){
                        result = levelPlayer(player,statIncreases)
                        player = result[0]
                        statIncreases = result[1]
                    }
                    messages.push(player.name + " received " + drop.amount + " " + drop.resourceName + " " + emoji)
                    if(player.level > prevLevel){
                        messages.push(player.name + " is now level " + player.level + "!")
                        messages.push(player.name + " earned " + player.level * 50 + " gold💰")
                        let statMessage = ""
                        for(s in statIncreases){
                            if(statIncreases[s] != 0){
                                statMessage += "\n(" + s.toUpperCase() + " +" + statIncreases[s] + ")"
                            }
                        }
                        messages.push(statMessage)
                    }
                    break;

                case "gold":
                    emoji = "💰"
                    player.gold += drop.amount
                    messages.push(player.name + " received " + drop.amount + " " + drop.resourceName + " " + emoji)
                    break;
                case "abilitypoints":
                    emoji = "💪"
                    player.abilitypoints += drop.amount
                    messages.push(player.name + " received " + drop.amount + " " + drop.resourceName + " " + emoji)
                    break;
                case "statpoints":
                    emoji = "⬆️"
                    player.statpoints += drop.amount
                    messages.push(player.name + " received " + drop.amount + " " + drop.resourceName + " " + emoji)
                    break;
            }
            break;
    }

    return [player,messages,drop];
}

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
            Eval = 1.25;
            break;

         case 1:
            Eval = 1.75;
            break;

        case 2:
            Eval = 1.25;
            break;

        case 3:
            Eval = 2;
            break;

        case 4:
            Eval = 3;
            break;
    }
    let statDistrib = {
        "spd": 0.9,
        "def": 1.4,
        "spdef": 1.1,
        "atk": 1,
        "spatk": 1
    }
    Eval *= statDistrib[e.stat]
    let allyTargets = [0,1]
    Eval *= Math.pow(Math.abs(e.value),1.4)
    if(allyTargets.includes(parseInt(e.target))){
        if(e.value < 0){
            Eval *= -1
        }
    }
    if(4 == parseInt(e.target)){
        if(e.value > 0){
            Eval *= -1
        }
    }
    return Eval * 50;
}

function calculateAbilityCost(ability,weapon,race){
    let weights = {}
    // Disregarding weights for now
    //
    // if(weapon != undefined){
    //     for(cat in weapon[ability.action_type]){
    //         if(!weights[cat]){
    //             weights[cat] = 1
    //             weights[cat] += weapon[ability.action_type][cat]
    //         }
    //     }
    // }
    // if(race != undefined){
    //     for(cat in race[ability.action_type]){
    //         if(!weights[cat]){
    //             weights[cat] = 1
    //             weights[cat] += race[ability.action_type][cat]
    //         }
    //     }
    // }
    for(cat in ability){
        weights[cat] = 1 
    }
    if(weights.effectStrength == undefined){
        weights.effectStrength = 1
    }
    let value = 0
    switch(ability.action_type){
        case "attack":
            value = Math.pow(ability.damage_val/4,2) * weights.damage_val
            value *= {
                0:0.8,
                1:1,
                2:2,
                4:8
            }[ability.speed] * weights.speed

            if(ability.numHits > 1){
                value *=  Math.pow(ability.numHits,1.46) * weights.numHits
            }


            if(ability.critical > 0){
                value *= Math.pow(Math.ceil((ability.critical* weights.critical)/5),0.27) 
            }

            value *= 1 - (0.9025 * ((ability.recoil * weights.recoil)/100))

            value *= {
                1:1,
                2:5,
                3:3
            }[ability.targetType]

            if(ability.accuracy <= 100){
                value *= (ability.accuracy/100) * weights.accuracy
            } else if(ability.accuracy > 100){
                value *= Math.pow((ability.accuracy-100)/5,0.56) * weights.accuracy
            }

            if(ability.stance != "none"){
                value *= 1.5
            }
            break 
        case "guard":
            value = Math.pow(ability.guard_val/6,2) * weights.guard_val + Math.pow(ability.counter_val/5,2) * weights.counter_val
            if(ability.success_level > 100){
                value *= {
                    "200":2,
                    "400":5
                }[ability.success_level]
            } else {
                value *= ability.success_level/100
            }
            break;
        case "stats":
            if(!ability.focus){
                ability.focus = 75
            }
            value = 0;
            for(e of ability.effects){
                value += calculateEffectCost(e) * weights.effectStrength
            }
            value *= {
                0:0.7,
                1:1,
                2:3,
                4:6
            }[ability.speed] * weights.speed
            value *= [1,1.2,1.5][ability.effects.length - 1]
            if(ability.speed >= 1){
                value *= Math.pow((ability.focus/75),7.22826251896)
            } else {
                value *= Math.pow((ability.focus/75),4.81884167931)
            }
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

function levelPlayer(player,statIncreases){
    player.level++;
    player.statpoints += 2;
    player.abilitypoints += 2;
    player.gold += player.level * 50;
    player.exp -= player.expCap
    player.expCap = Math.floor(player.level * (47.5 + player.level * 2.5))
    let stats = ["hp","atk","def","spatk","spdef","spd"]
    if(statIncreases == undefined){
        statIncreases = {
            "hp":0,
            "atk":0,
            "def":0,
            "spatk":0,
            "spdef":0,
            "spd":0
        }
    }
    for(var i = 0;i < 6; i++){
        let stat = stats[Math.floor(Math.random() * stats.length)]
        player.stats[stat] += 1
        statIncreases[stat]++
    }
    return [player,statIncreases]
}

function formatTown(town){
    let foodCheck = town.resources.wood[0] >= town.resources.food[1]
    let woodCheck = town.resources.wood[0] >= town.resources.wood[1]   
    let mineralsCheck = town.resources.minerals[0] >= town.resources.minerals[1]
    let resourceCheck = foodCheck && woodCheck && mineralsCheck
    if(resourceCheck && town.dungeonClear && town.points >= town.level * 30){
        town.resources.food[0] -= town.resources.food[1]
        town.resources.wood[0] -= town.resources.wood[1]
        town.resources.minerals[0] -= town.resources.minerals[1]
        town.resources.food[1] *= 2
        town.resources.wood[1] *= 2
        town.resources.minerals[1] *= 2
        town.points -= town.level * 30
        town.level++
        town.dungeonClear = false
    } else if(resourceCheck && town.points < town.level * 30){
        town.resources.food[0] -= Math.ceil(town.resources.food[1] * 0.1)
        town.resources.wood[0] -= Math.ceil(town.resources.wood[1] * 0.1)
        town.resources.minerals[0] -= Math.ceil(town.resources.minerals[1] * 0.1)
        town.points += Math.ceil((town.level * 30) * 0.1)
        if(town.points > town.level * 30){
            town.points = town.level * 30
        }
    }
    return town
}

function addAbilityScalingNames(name,ability,stats,type,useNormals = true){
        let statFields = arrayShuffle(stats)
        let typeBank = nameBank.ability[type]
        let validStats = []
        for(var i = 0 ;i < 2;i++){
            let highestScalarVal = -1;
            let highestStatVal = 0
            let highestStat = "";
            for(s of statFields){
                let statVal = ability[s]
                let bankData = typeBank[s]
                if(statVal != bankData.base){
                    for(var x in bankData.scalar){
                        let scalarVal = bankData.scalar[x]
                        let flag;
                        if(x < bankData.scalar.length - 1){
                            flag = statVal >= scalarVal && statVal < bankData.scalar[parseInt(x)+1]
                        } else {
                            flag = statVal == scalarVal
                        }
                        if(flag){
                            if(bankData.scalarWeights[x] > highestScalarVal){
                                highestStat = s
                                highestScalarVal = bankData.scalarWeights[x]
                                highestStatVal = scalarVal
                            }
                        }
                    }
                }
            }
            
            if(highestStat != ""){
                validStats.push([highestStat,highestStatVal])
                statFields.splice(statFields.indexOf(highestStat),1)
            }
        }

        let choices;
        let adding = 1
        for(let i = 0; i < adding; i++){
            if(validStats.length == 0){
                if(useNormals){
                    choices = ["Normal","Basic","Simple"] 
                } else {
                    choices = []
                }
            } else {
                adding = validStats.length
                choices = typeBank[validStats[i][0]][validStats[i][1]]
            }

            if(choices.length > 0){
                name += " " + choices[Math.floor(Math.random() * choices.length)]
            }
        }
        return name
}

function generateAbilityName(ability){
    let name = ""
    switch(ability.action_type){
        case "attack":
            let starts = [""]
            switch(parseInt(ability.targetType)){
                case 2:
                    starts = ["Extensive"]
                    break;
                
                case 3:
                    starts = ["Widespread"]
                    break;
            }
            name = starts[Math.floor(Math.random() * starts.length)]
            
            name = addAbilityScalingNames(name,ability,["critical","recoil","accuracy","speed"],ability.action_type)

            let damageMilestones = [10,20,40,60,80,101]
            for(i in damageMilestones){
                let val = damageMilestones[i]
                if(ability.damage_val < val){
                    let names = nameBank.ability.attack.title[ability.damage_type][damageMilestones[i-1]]
                    name += " " + names[Math.floor(Math.random() * names.length)]
                    break;
                }
            }
            let endings = [""];
            switch(ability.numHits){
                case 2:
                    let ESendings = ["s","ch","x","z"]
                    if(ESendings.includes(name.slice(-2))){
                        endings = ["es"]
                    } else {
                        endings = ["s"]
                    }
                case 3:
                    endings = [" Combo"]
                    break;    
                case 4:
                    endings = [" Barrage"," Volley"]
                case 5:
                    endings = [" Flurry"," Frenzy"," Storm"]
                    break;
            }
            name += endings[Math.floor(Math.random() * endings.length)]
            break;

        case "stats":
            let primeEffect;
            let primeEffectValue = 0
            for(e in ability.effects){
                let val = calculateEffectCost(ability.effects[e])
                if(Math.abs(val) > primeEffectValue){
                    primeEffect = ability.effects[e]
                    primeEffectValue = val
                }
            }
            let list;
            if(!primeEffect){
                console.log(ability.effects)
            }
            if(primeEffect.value > 0){
                list = nameBank.ability.stats.stat.pos[primeEffect.stat]
            } else {
                list = nameBank.ability.stats.stat.neg[primeEffect.stat]
            }
            name += list[Math.floor(Math.random() * list.length)]

            name = addAbilityScalingNames(name,ability,["focus","speed"],ability.action_type,false)

            let targetList = nameBank.ability.stats.target[primeEffect.target]
            name += " " + targetList[Math.floor(Math.random() * targetList.length)]
            break;

        case "guard":
            name = addAbilityScalingNames(name,ability,["counter_val","success_level"],ability.action_type)
            let guardMilestones = [10,40,80,120,160,201]
            for(i in guardMilestones){
                let val = guardMilestones[i]
                if(ability.guard_val < val){
                    let names = nameBank.ability.guard.title[ability.guard_type][guardMilestones[i-1]]
                    name += " " + names[Math.floor(Math.random() * names.length)]
                    break;
                }
            }
            break;
    }
    return name.trim()
}

function generateEquipmentName(equipment){
    let name = "";
    let pList,sList,nList,aList,nameList;
    let greatestStat = ""
    let greatestVal = 0
    for(s in equipment.stats){
        let statVal = equipment.stats[s]
        if(statVal > greatestVal){
            greatestStat = s
            greatestVal = statVal
        }
    }
    if(greatestVal != 0){
        pList = nameBank.equipment.statTags[greatestStat]
    }

    let secondaryStat = ""
    let secondaryVal = 0
    for(s in equipment.stats){
        let statVal = equipment.stats[s]
        if(statVal > secondaryVal && statVal > Math.floor(greatestVal/2) && s != greatestStat){
            secondaryStat = s
            secondaryVal = statVal
        }
    }
    if(secondaryVal != 0){
        sList = nameBank.equipment.statsubTags[secondaryStat]
    }

    let negStat = ""
    let negVal = 0
    for(s in equipment.stats){
        let statVal = equipment.stats[s]
        if(statVal < negVal){
            negStat = s
            negVal = statVal
        }
    }
    if(negVal != 0){
        nList = nameBank.equipment.statNegTags[negStat]
    }

    let highestPerk = "0"
    let perkVal = 0
    for(p in equipment.typePerks){
        let pVal = equipment.typePerks[p]
        if(pVal > perkVal){
            highestPerk = p
            perkVal = pVal
        }
    }
    
    
    switch(equipment.type){
        case "weapon": 
            nameList = nameBank.equipment.weapon.titles[equipment.weaponStyle]
            if(perkVal != 0){
                aList = nameBank.equipment.weapon.perkTags[highestPerk]
            }
            break;

        case "gear":
            nameList = nameBank.equipment.gear.titles
            if(perkVal != 0){
                aList = nameBank.equipment.gear.perkTags[highestPerk]
            }
            break;
    }

    let order = [nList,pList,aList,sList,nameList]
    for(list of order){
        if(list != null){
            name = name + " " + list[Math.floor(Math.random() * list.length)] 
        }
    }

    return name.trim()
}

function generateRNGEquipment(dropData,SP){
    let rngSet = dropData.ref.rngEquipment
    let equipmentData = clone(templates.emptyEquipmentData)

    if(rngSet.weaponType){
        equipmentData.weaponStyle = rngSet.weaponType
        equipmentData.type = "weapon"
    } else {
        equipmentData.type = rngSet.types[Math.floor(Math.random() * rngSet.types.length)]
        if(equipmentData.type == "weapon"){
            equipmentData.weaponStyle = Math.floor(Math.random() * 4)
        }
    }

    let val;
    if(rngSet.scaling){
        val = SP
    } else {
        val = rngSet.baseVal
    }

    conVal = Math.ceil(Math.pow(val * rngSet.conValue,0.9)) * 6
    val = Math.ceil(Math.pow(val * rngSet.value,0.9)) * 6

    console.log("Value: " + val)
    let conStats = rngSet.conStats

    let attributes = []

    if(rngSet.forceStats){
        for(s of rngSet.forceStats){
            if(s[1] == true && s[1] != 1){
                attributes.push(s[0])
            }
        }
    }

    if(rngSet.lockStatTypes){
        switch(equipmentData.type){
            case "weapon":
                attributes = attributes.concat(["atk","spatk","spd","baseAtkBoost","baseSpAtkBoost"])
                break;

            case "gear":
                attributes = attributes.concat(["def","spdef","hp","baseDefBoost","baseSpDefBoost"])
                break;
        }
    } else {
        attributes = attributes.concat(["atk","spatk","spd","def","spdef","hp","baseAtkBoost","baseSpAtkBoost","baseDefBoost","baseSpDefBoost"])
    }

    let equipGenStatMultis = {
        hp: 0.1,
        atk: 0.8,
        def: 0.7,
        spatk: 0.8,
        spdef: 0.7,
        spd: 1,
        baseAtkBoost: 0.04,
        baseSpAtkBoost: 0.04,
        baseDefBoost: 0.02,
        baseSpDefBoost: 0.02
    }

    for(let i = 0;i < conStats;i++){
        let index = Math.floor(Math.random() * attributes.length)
        let stat = attributes[index]
        equipmentData.stats[stat] = Math.ceil(conVal / conStats * equipGenStatMultis[stat]) * -1
        attributes.splice(index,1)
    }

    let perkMax = weightedRandom([
        {
            chance:33,
            obj:0
        },
        {
            chance:28,
            obj:1
        },
        {
            chance:22.5,
            obj:2
        },
        {
            chance:12.5,
            obj:3
        },
        {
            chance:4,
            obj:4
        },
    ])

    let perkVal,statVal;

    if(perkMax > 0 && val >= 15){
        perkVal = Math.floor(val * (0.2 + 0.6 * Math.random()))
        statVal = val - perkVal
        perkVal = Math.ceil(perkVal/15)
    } else {
        perkVal = 0
        statVal = val;
    }

    if(perkVal < perkMax){
        perkMax = perkVal
    }

    if(perkVal > perkMax * 5){
        statVal += (perkVal - perkMax * 5) * 15
        perkVal = (perkMax * 5)
    }

    let usedIndexes = []

    for(var x = 0;x < perkMax;x++){
        let index = Math.floor(equipmentData.typePerks.length * Math.random())
        while(equipmentData.typePerks[index] > 0){
            index = Math.floor(equipmentData.typePerks.length * Math.random())
        }
        usedIndexes.push(index)
        equipmentData.typePerks[index] = 1
        perkVal--
    }

    while(perkVal > 0){
        let index = usedIndexes[Math.floor(usedIndexes.length * Math.random())]
        while(equipmentData.typePerks[index] == 0 || equipmentData.typePerks[index] == 5){
            index = usedIndexes[Math.floor(usedIndexes.length * Math.random())]
        }
        equipmentData.typePerks[index]++
        perkVal--
    }

    let maxStatVal = statVal
    while(statVal > 0){
        let amount = Math.ceil(maxStatVal * Math.random() * 0.50)
        if(amount > statVal){
            amount = statVal
        }
        let index = Math.floor(Math.random() * attributes.length)
        let stat = attributes[index]
        equipmentData.stats[stat] += amount * equipGenStatMultis[stat]
        statVal -= amount 
    }

    for(s in equipmentData.stats){
        equipmentData.stats[s] = Math.round(equipmentData.stats[s])
    }
    equipmentData.stats.baseAtkBoost *= 5
    equipmentData.stats.baseSpAtkBoost *= 5
    equipmentData.stats.baseDefBoost *= 5
    equipmentData.stats.baseSpDefBoost *= 5
    equipmentData.name = generateEquipmentName(equipmentData)
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

function modifyStat(stat,ability,int){
    switch(stat[2]){
        case "inc":
            if(stat[4]){
                ability[stat[0]] -= stat[1][2] * int * Math.floor(Math.random() * (stat[1][1]/stat[1][2]))
            } else {
                ability[stat[0]] += stat[1][2] * int * Math.floor(Math.random() * (stat[1][1]/stat[1][2]))
            }
            if(ability[stat[0]] > stat[1][1]){
                ability[stat[0]] = stat[1][1]
            }
            if(ability[stat[0]] < stat[1][0]){
                ability[stat[0]] = stat[1][0]
            }
            break;

        case "val":
            if(int > 0){
                if(stat[1].indexOf(ability[stat[0]]) < stat[1].length - 1){
                    let newIndex = stat[1].indexOf(ability[stat[0]]) + Math.floor(Math.random() * stat[1].length)
                    if(newIndex > stat[1].length - 1){
                        ability[stat[0]] = stat[1][stat[1].length - 1]
                    } else {
                        ability[stat[0]] = stat[1][newIndex]
                    }
                }
            } else {
                if(stat[1].indexOf(ability[stat[0]]) > 0){
                    let newIndex = stat[1].indexOf(ability[stat[0]]) - Math.floor(Math.random() * stat[1].length)
                    if(newIndex < 0){
                        ability[stat[0]] = stat[1][0]
                    } else {
                        ability[stat[0]] = stat[1][newIndex]
                    }
                }
            }
            break;
    }
}

function upgradeEffect(effect){
    let effectValues = [
        ["target",["4","3","2","0","1"],"val",30],
        ["value",[-4,4,1],"inc",70]
    ]
    let stat = effectValues[Math.floor(Math.random() * effectValues.length)]
    if(stat[0] == "target"){
        if(effect.value < 0){
            stat[1] = stat[1].reverse()
        }
    }
    modifyStat(stat,effect,1)
}

function downgradeEffect(effect){
    let effectValues = [
        ["target",["4","3","2","0","1"],"val",30],
        ["value",[-4,4,1],"inc",70]
    ]
    let stat = effectValues[Math.floor(Math.random() * effectValues.length)]
    if(stat[0] == "target"){
        if(effect.value < 0){
            stat[1] = stat[1].reverse()
        }
    }
    modifyStat(stat,effect,-1)
}

function upgradeAbility(typeValues,ability,limit){
    while(calculateAbilityCost(ability) < limit){
        //console.log("increasing",ability.action_type)
        let targetStat;
        let changeMade = false;
        if(ability.action_type == "stats"){
            if(Math.random() < 0.5){
                if(Math.random() < 0.5 && ability.effects.length < 3){
                    let stats;
                    let newEffect; 
                    if(Math.random() < 0.5){
                        stats = clone(ability.benstats)
                        newEffect = {
                            target: "0",
                            stat: "",
                            value: 1
                        }
                    } else {
                        stats = ["atk","spatk","def","spdef","spd"]
                        newEffect = {
                            target: "3",
                            stat: "",
                            value: -1
                        }
                    }
                    for(e of ability.effects){
                        stats.splice(stats.indexOf(e.stat),1)
                    }
                    newEffect.stat = stats[Math.floor(Math.random() * stats.length)]
                    ability.effects.push(newEffect)
                    ability.statChangeCount = ability.effects.length
                    changeMade = true
                } else {
                    let index = Math.floor(Math.random() * ability.effects.length)
                    if(calculateEffectCost(ability.effects[index]) < 0 && ability.effects.length > 1){
                        ability.effects.splice(index,1)
                        ability.statChangeCount = ability.effects.length
                    } else {
                        upgradeEffect(ability.effects[index])
                    }
                    changeMade = true
                }
            }
        }
        if(!changeMade){
            let valueList = []
            for(value of typeValues){
                let max;
                if(value[2] == "val"){
                    max = value[1][value[1].length - 1]
                } else {
                    max = value[1][1]
                }

                if(ability[value[0]] != max){
                    valueList.push({
                        chance:value[3],
                        obj:value
                    })
                }
            }
            if(valueList.length > 0){
                targetStat = weightedRandom(valueList)
                modifyStat(targetStat,ability,1)
                changeMade = true
            }
        }
    }
}

function downgradeAbility(typeValues,ability,limit){
    while(calculateAbilityCost(ability) > limit){
        //console.log("decreasing",ability.action_type)
        let targetStat;
        let changeMade = false;
        if(ability.action_type == "stats"){
            if(Math.random() < 0.5){
                if(Math.random() < 0.5 && ability.effects.length < 3){
                    let stats; 
                    let newEffect; 
                    if(Math.random() < 0.5){
                        stats = ["atk","spatk","def","spdef","spd"]
                        newEffect = {
                            target: "0",
                            stat: "",
                            value: -1
                        }
                    } else {
                        stats = ["atk","spatk","def","spdef","spd"]
                        newEffect = {
                            target: "3",
                            stat: "",
                            value: 1
                        }
                    }
                    for(e of ability.effects){
                        stats.splice(stats.indexOf(e.stat),1)
                    }
                    newEffect.stat = stats[Math.floor(Math.random() * stats.length)]
                    ability.effects.push(newEffect)
                    changeMade = true
                } else {
                    let index = Math.floor(Math.random() * ability.effects.length)
                    if(calculateEffectCost(ability.effects[index]) > 0 && ability.effects.length > 1){
                        ability.effects.splice(index,1)
                        ability.statChangeCount = ability.effects.length
                    } else {
                        downgradeEffect(ability.effects[index])
                    }
                    changeMade = true
                }
            }
        }
        if(!changeMade){
            let valueList = []
            for(value of typeValues){
                if(ability[value[0]] != value[1][0]){
                    valueList.push({
                        chance:value[3],
                        obj:value
                    })
                }
            }
            if(valueList.length > 0){
                targetStat = weightedRandom(valueList)
                modifyStat(targetStat,ability,-1)
                changeMade = true;
            }
        }
    }
}

function generateRNGAbility(abilityData,forcedFields,options){
    let actionType = ["attack","guard","stats"][Math.floor(Math.random() * 3)]
    if(abilityData.forceType){
        actionType = abilityData.forceType
    }
    let typeValues;
    let newAbility;
    let finalVal = abilityData.baseVal
    let cost;
    switch(actionType){
        case "attack":
            typeValues = [
                ["critical",[0,80,5],"inc",12],
                ["damage_val",[10,100,5],"inc",35],
                ["numHits",[1,5,1],"inc",5],
                ["recoil",[0,100,5],"inc",12,true],
                ["targetType",["1","2","3"],"val",12],
                ["accuracy",[60,130,10],"inc",12],
                ["speed",[0,1,2,4],"val",12]
            ]
            newAbility = clone(templates.attack)
            if(forcedFields.damage_type){
                newAbility.damage_type = forcedFields.damage_type
            } else {
                newAbility.damage_type = ["atk","spatk"][Math.floor(Math.random() * 2)]
            }

            if(forcedFields.stance){
                newAbility.stance = forcedFields.stance
            }
            
            newAbility.damage_val = 10
            cost = calculateAbilityCost(newAbility)
            break;

        case "guard":
            typeValues = [
                ["guard_val",[10,200,5],"inc",30],
                ["counter_val",[0,200,5],"inc",30],
                ["success_level",["100","200","400"],"val",40]
            ]
            newAbility = clone(templates.guard)
            newAbility.guard_type = ["def","spdef"][Math.floor(Math.random() * 2)]
            newAbility.counter_type = newAbility.guard_type
            newAbility.guard_val = 10
            cost = calculateAbilityCost(newAbility)
            break;

        case "stats":
            typeValues = [
                ["speed",[0,1,2,4],"val",20],
                ["focus",[60,100,5],"inc",80]
            ]
            newAbility = clone(templates.stats)
            let benstats = ["def","spdef","spd"]
            if(options.bestDmg){
                benstats.push(options.bestDmg)
            }
            newAbility.benstats = benstats
            newAbility.effects[0].stat = benstats[Math.floor(Math.random() * benstats.length)]
            cost = calculateAbilityCost(newAbility)
            break;
    }

    if(forcedFields != undefined){
        for(field in forcedFields){
            for(i in typeValues){
                if(typeValues[i][0] == field){
                    typeValues.splice(i,1)
                    newAbility[field] = forcedFields[field]        
                }
            }
        }
    }
    
    while(cost < finalVal * 0.95 || cost > finalVal * 1.05){
        upgradeAbility(typeValues,newAbility,finalVal)
        downgradeAbility(typeValues,newAbility,finalVal)
        cost = calculateAbilityCost(newAbility)
    }

    delete newAbility.benstats
    newAbility.name = generateAbilityName(newAbility)
    return newAbility
}

function addAdditionals(string,additionals){
    if(additionals.length != 0){
        string += "Additionally this ability"
        for(var i =0; i < additionals.length;i++){
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
            desc += "The user attacks " + {
                "1":"it's target",
                "2":"all enemies",
                "3":"everyone else"
            }[ability.targetType]
            if(ability.numHits != 1){
                desc += " " + ability.numHits + " times"
            }
            desc += " using their " + ability.damage_type + " stat with a base damage of " + ability.damage_val + ". "
            additionals = []
            if(ability.critical > 0){
                additionals.push(" has a " + ability.critical + "% chance to critically hit")
            }
            if(ability.recoil > 0){
                additionals.push(" deals " + ability.recoil + "% of user's maximum health as damage to the user")
            }
            if(ability.speed != 1){
                let speedRating = ""
                switch(parseInt(ability.speed)){
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
            if(ability.stance != "none"){
                let stanceDict = {
                    "hp":"Adapting",
                    "atk":"Raiding",
                    "def":"Daring",
                    "spatk":"Cunning",
                    "spdef":"Dominating",
                    "spd":"Advancing",
                }
                additionals.push(" aligns with a " + stanceDict[ability.stance] + " stance")
            }
            desc = addAdditionals(desc,additionals)
            break;
        case "guard":
            desc += "The user lowers the base damage of an incoming " + {
                "def":"atk",
                "spdef":"spatk"
            }[ability.guard_type] + " attack by " + ability.guard_val + " (If attack uses " + {
                "def":"spatk",
                "spdef":"atk"
            }[ability.guard_type] + " stat, " + ability.guard_val/2 + ")."
            if(ability.counter_val > 0){
                desc += " If the attack was " + {
                    "def":"atk",
                    "spdef":"spatk"
                }[ability.guard_type] + " based, they use their " + ability.counter_type + " stat to counter attack with a base damage of " + ability.counter_val + "."

            }
            if(ability.success_level != 100){
                if(ability.success_level > 100){
                    desc += {
                        "200":" Additionally, this ability becomes unreliable after 1 consecutive guard ability has been used.",
                        "400":" Additionally, this ability becomes unreliable after 2 consecutive guard abilities has been used."
                    }[ability.success_level]
                } else {
                    desc += " Additionally, this ability has it's chance of success decreased by " + (100 - ability.success_level) + "%."
                }
            }
            break;

        case "stats":
            // REMOVE ON WIPE
            if(!ability.focus){
                ability.focus = 75
            }

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
            if(ability.focus < 100){
                desc += "If the user is damaged before using this ability, it has a " + (100 - ability.focus) + "% chance to fail. "
            }
            if(ability.speed != 1){
                let speedRating = ""
                switch(parseInt(ability.speed)){
                    case 0:
                        speedRating = " is slower than most other actions"
                        break;
                    
                    case 2:
                        speedRating = " is faster than the average action"
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
    formatTown(town){
        return formatTown(town)
    },
    generateEquipmentName(item){
        return generateEquipmentName(item)
    },
    msToTime(s){
        return msToTime(s)
    },
    calculateAbilityCost(ability,weapon,race){
        return calculateAbilityCost(ability,weapon,race)
    },
    prepCombatFighter(fighter,index){

        for(ability of fighter.abilities){
            delete ability.faction
            if(ability.stance == undefined){
                ability.stance = "none"
            }
        }

        let fighterStats = clone(fighter.stats)
        let fWeapon = null;
        let fGear = null;
        let fDiscrim = ""
        let fTarget = null
        if(fighter.discrim){
            fDiscrim = fighter.discrim
        }
        if(fighter.target){
            fTarget = fighter.target
        }
        if(fighter.inventory){
            if(fighter.gear != undefined){
                fGear = fighter.inventory[fighter.gear]
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
            if(fighter.weapon != undefined){
                fWeapon = fighter.inventory[fighter.weapon]
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

        let discriminator = ""
        if(fDiscrim  == ""){
            for(var i = 0; i < 6;i++){
                discriminator += Math.floor(Math.random() * 10)
            }
        } else {
            discriminator = fDiscrim
        }

        let target = -1
        if(fTarget != null){
            target = fTarget
        }
        
        let fighterData = {
            weapon:fWeapon,
            gear:fGear,
            alive:true,
            forfeit:false,
            index:index,
            discriminator:discriminator,
            currentTarget:target,
            staticData:fighter,
            liveData:{
                stats:fighterStats,
                statChanges:{
                    atk:8,
                    spatk:8,
                    def:8,
                    spdef:8,
                    spd:8
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
                timesAbilityRepeat:0,
                livesLost:0,
                strongestStrike:0,
                empoweredAbilities:0,
                stanceSwitches:0,
                resistedAttacks:0,
                attacksResisted:0,
                effectiveAttacks:0,
                attacksEffected:0
            },
            choosenAbility:-1,
            target:-1,
            repeats:0,
            hasActed:false,
            lastAction:"",
            guardData:"none"
        }
        if(!fighterData.staticData.cpu){
            if(!fighterData.staticData.meterRank){
                fighterData.staticData.meterRank = 0
            }
            fighterData.meter = 0
            fighterData.staticData.meterRank
            fighterData.empowered = false
        }
        if(fighter.passives){
            fighterData.passives = fighter.passives
        }
        if(fighter.inventory){
            let gear = fighter.inventory[fighter.gear]
            let weapon = fighter.inventory[fighter.weapon]
            if(gear){
                fighterData.gearPassives = gear.typePerks
            } else {
                fighterData.gearPassives = [0,0,0,0,0,0,0,0,0,0]
            }
            if(weapon){
                fighterData.weaponPassives = weapon.typePerks
            } else {
                fighterData.weaponPassives = [0,0,0,0,0,0,0,0,0,0]
            }
        } else {
            fighterData.weaponPassives = [0,0,0,0,0,0,0,0,0,0]
            fighterData.gearPassives = [0,0,0,0,0,0,0,0,0,0]
        }
        while(fighterData.weaponPassives.length < 10){
            fighterData.weaponPassives.push(0)
        }
        while(fighterData.gearPassives.length < 10){
            fighterData.gearPassives.push(0)
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
                            fighterData.liveData.healing += b.value
                            break;

                        case "random":
                            let stats = ["atk","spatk","def","spdef","spd"]
                            fighterData.liveData.statChanges[stats[Math.floor(Math.random() * stats.length)]] += b.value
                            break;
                    }
                }
            }
        }

        if(fighterData.staticData.weakPoint){
            if(fighterData.staticData.weakPoint == true){
                fighterData.staticData.weakPoint = 1 + Math.floor(Math.random() * 6)   
            }
            fighterData.weakPointHit = false
        }

        if(fighterData.staticData.lootPoint){
            if(fighterData.staticData.lootPoint == true){
                fighterData.staticData.lootPoint = 1 + Math.floor(Math.random() * 6)   
            }
            fighterData.lootPointHit = false
        }

        if(fighterData.staticData.stances == undefined){
            fighterData.staticData.stances = clone(templates.emptyPlayerData.stances)
        }
        delete fighterData.staticData.faction
        if(fighterData.staticData.stance == undefined){
            fighterData.staticData.stance = "none"
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
                        let stanceOptions = []
                        for(stance in fighter.staticData.stances){
                            if(fighter.staticData.stances[stance].active && fighter.staticData.stance != stance){
                                stanceOptions.push({
                                    "action_type":"stance",
                                    "stance":stance
                                })
                            }
                        }
                        if(stanceOptions.length > 0){
                            if(Math.random() < 0.25){
                                selectAbility = false
                                fighter.stanceSwitch = stanceOptions[Math.floor(Math.random() * stanceOptions.length)].stance
                            }
                        }
                        let canRethink = true;
                        while(selectAbility){
                            let nextAction;
                            let abilityTypes = []
                            for(ability of fighter.staticData.abilities){
                                if(!abilityTypes.includes(ability.action_type)){
                                    abilityTypes.push(ability.action_type)
                                }
                            }
                            
                            fighter.choosenAbility = (Math.floor(Math.random() * fighter.staticData.abilities.length)).toString()
                            let abilityData = fighter.staticData.abilities[fighter.choosenAbility]
                    
                            if(abilityTypes.length >= 2){
                                if(fighter.typeHistory == undefined){
                                    fighter.typeHistory = []
                                }

                                for(type of fighter.typeHistory){
                                    abilityTypes.splice(abilityTypes.indexOf(type),1)
                                }
                                
                                while(!abilityTypes.includes(abilityData.action_type)){
                                    fighter.choosenAbility = (Math.floor(Math.random() * fighter.staticData.abilities.length)).toString()
                                    abilityData = fighter.staticData.abilities[fighter.choosenAbility]
                                }

                                if(abilityTypes.length == 1){
                                    canRethink = false
                                    delete fighter.typeHistory
                                }
                            }

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
                                
                                case "stats":
                                    let highestStatVal = 0
                                    let forAlly = false;
                                    for(effect of abilityData.effects){
                                        if(Math.abs(effect.value) > highestStatVal){
                                            highestStatVal = Math.abs(effect.value)
                                            if(effect.target == "2"){
                                                forAlly = effect.value > 0
                                            }
                                        }
                                    }
                                    if(fighters.length == 2){
                                        fighter.target = [1,0][fighter.index]
                                    } else {
                                        if(fighter.currentTarget == -1){
                                            if(fighter.team != null){
                                                let targetI;
                                                if(forAlly){
                                                    let teamCount = 0;
                                                    for(f of fighters){
                                                        if(f.alive && f.team == fighter.team){
                                                            teamCount++
                                                        }
                                                    }
                                                    if(teamCount > 1){
                                                        targetI = Math.floor(Math.random() * fighters.length)
                                                        while(targetI == fighter.index || fighters[targetI].team != fighter.team || fighters[targetI].alive == false){
                                                            targetI = Math.floor(Math.random() * fighters.length)
                                                        } 
                                                    } else {
                                                        targetI = Math.floor(Math.random() * fighters.length)
                                                        while(targetI == fighter.index || fighters[targetI].alive == false){
                                                            targetI = Math.floor(Math.random() * fighters.length)
                                                        } 
                                                    }
                                                } else {
                                                    targetI = Math.floor(Math.random() * fighters.length)
                                                    while(targetI == fighter.index || fighters[targetI].team == fighter.team || fighters[targetI].alive == false){
                                                        targetI = Math.floor(Math.random() * fighters.length)
                                                    }
                                                }
                                                fighter.target = targetI
                                            } else {
                                                let targetI = Math.floor(Math.random() * fighters.length)
                                                while(targetI == fighter.index || fighters[targetI].alive == false){
                                                    targetI = Math.floor(Math.random() * fighters.length)
                                                }
                                                fighter.target = targetI
                                            }
                                        } else {
                                            for(var x = 0; x < fighters.length;x++){
                                                if(parseInt(fighters[x].discriminator) == fighter.currentTarget){
                                                    fighter.target = x 
                                                }
                                            }
                                        }
                                    }
                                    nextAction = fighter.index + "_" + abilityData.name + "_" + fighters[fighter.target]
                                    break;
                            }
                            if(nextAction == fighter.lastAction && fighter.staticData.intelligence && canRethink){
                                selectAbility = fighter.staticData.intelligence.reuse < Math.random()
                            } else {
                                selectAbility = false                                 
                                if(fighter.typeHistory){
                                    fighter.typeHistory.push(abilityData.action_type)
                                } else {
                                    fighter.typeHistory = [abilityData.action_type]
                                }
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
        let data = "**__" + item.name + "__**\n\n"
        let rankNumerals = {
            "0":0,
            "1":"I",
            "2":"II",
            "3":"III",
            "4":"IV",
            "5":"V"
        }
        let statDict = {
            "hp": "HP",
            "atk": "ATK",
            "def": "DEF",
            "spatk": "SPATK",
            "spdef": "SPDEF",
            "spd": "SPD",
            "baseAtkBoost": "ATK ABILITY BASE DMG",
            "baseSpAtkBoost": "SPATK ABILITY BASE DMG",
            "baseDefBoost": "DEF ABILITY GUARD VALUE",
            "baseSpDefBoost": "SPDEF ABILITY GUARD VALUE"
        }
        switch(item.type){
            case "weapon":
                data += "Type: " + [
                    "Melee\nClass Synergy:\n> **Physical Attacks have higher chance of succeeding when used in succession**",
                    "Ranged\nClass Synergy:\n> **Gain up to 30% critical chance based on ability speed priority**",
                    "Spell-Casting\nClass Synergy:\n> **Critical Special Attacks have a 3x damage multiplier**",
                    "Rune-Based\nClass Synergy:\n> **Attack hits have a 15% to increase the used offensive stat by 1 stage**"
                ][item.weaponStyle]
                for(s in statDict){
                    let val = item.stats[s]
                    if(s == "hp"){
                        val *= 2
                    }
                    if(val > 0){
                        if(zeroStats){
                            data += "\n```diff\n"
                        }
                        zeroStats = false
                        data += "+" + val + " " + statDict[s] + "\n"
                    } else if (val < 0){
                        if(zeroStats){
                            data += "\n```diff\n"
                        }
                        zeroStats = false
                        data += val + " " + statDict[s] + "\n"
                    }
                }
                if(!zeroStats){
                    data += "```\n"
                } else {
                    data += "\n\n"
                }
                let noWeaponPerks = true
                for(p in item.typePerks){
                    let val = item.typePerks[p]
                    if(val > 0){
                        noWeaponPerks = false;
                        data += equipmentPerkDescriptions.weapon[p][2] + " " + rankNumerals[val] + "\n> " + equipmentPerkDescriptions.weapon[p][0].replace("X",equipmentPerkDescriptions.weapon[p][1] * val) + "\n\n"
                    }
                }
                break;

            case "gear":
                data += "Type: Gear"
                for(s in statDict){
                    let val = item.stats[s]
                    if(s == "hp"){
                        val *= 2
                    }
                    if(val > 0){
                        if(zeroStats){
                            data += "\n```diff\n"
                        }
                        zeroStats = false
                        data += "+" + val + " " + statDict[s] + "\n"
                    } else if (val < 0){
                        if(zeroStats){
                            data += "\n```diff\n"
                        }
                        zeroStats = false
                        data += val + " " + statDict[s] + "\n"
                    }
                }
                if(!zeroStats){
                    data += "```\n"
                } else {
                    data += "\n"
                }
                let nogearPerks = true
                for(p in item.typePerks){
                    let val = item.typePerks[p]
                    if(val > 0){
                        nogearPerks = false;
                        data += equipmentPerkDescriptions.gear[p][2] + " " + rankNumerals[val] + "\n> " + equipmentPerkDescriptions.gear[p][0].replace("X",equipmentPerkDescriptions.gear[p][1] * val) + "\n\n"
                    }
                }
                break;

            case "loot":
                data += "Type: Loot\n\n"
                data += "Count: " + item.count + "\n"
                data += "Value: " + item.value + "\n"

        }
        return data
    },
    levelPlayer(player,statIncreases){
        return levelPlayer(player,statIncreases)
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
        
        let reps = 0

        while(allowance > 0 && unit.abilities.length < 6 && reps < 30){
            let forceType;
            let abilityTypes = []
            for(ability of unit.abilities){
                if(!abilityTypes.includes(ability.action_type)){
                    abilityTypes.push(ability.action_type)
                }
            }
            if(!abilityTypes.includes("attack")){
                forceType = "attack"
            } else {
                forceType = ["attack","guard","stats"][Math.floor(Math.random() * 3)]
            }
            if(allowance >= 2 && Math.random() < 0.75){
                let rngValue = Math.ceil(Math.random() * allowance)
                let newData = {
                    baseVal: Math.ceil(100 * (rngValue/3 + 1.125)),
                    forceType: forceType
                }
                let bestDmg;
                if(unit.stats.atk > unit.stats.spatk){
                    bestDmg = "atk"
                } else {
                    bestDmg = "spatk"
                }
                let ability = generateRNGAbility(newData,{
                    "accuracy": weightedRandom([
                        {
                            chance:25,
                            obj:110
                        },
                        {
                            chance:25,
                            obj:80
                        },
                        {
                            chance:25,
                            obj:100
                        }
                    ]),
                    "speed": weightedRandom([
                        {
                            chance:75,
                            obj:1
                        },
                        {
                            chance:25,
                            obj:2
                        }
                    ]),
                    "targetType":"1",
                    "stance":unit.stance,
                    "damage_type":bestDmg
                },{
                    bestDmg:bestDmg
                })
                allowance -= rngValue
                unit.abilities.push(ability)
            } else {
                let desiredSpend = Math.ceil(Math.random() * highestCost)
                if(abilityDict[desiredSpend]){
                    let catalouge = clone(abilityDict[desiredSpend])
                    let chosen;
                    do {
                        let x = Math.floor(Math.random() * catalouge.length)
                        chosen = catalouge[x]
                        catalouge.splice(x,1)
                    } while(chosen.ability.action_type != forceType && catalouge.length > 0)
                    if(!(catalouge.length == 0 && chosen.ability.action_type == forceType)){
                        unit.abilities.push(chosen.ability)
                        allowance -= chosen.allowanceCost
                    }
                }
            }
            reps++
        }
        return unit
    },
    simulateCPUSPAssign(unit,points,unitScalar){
        let stats = arrayShuffle(["hp","atk","def","spatk","spdef","spd"])
        let statTotal = 0
        let spent = 0
        let pointsMax = points
        while(Math.floor(points) > 0){
            for(var i = 0; i < stats.length; i++){
                let toSpend = Math.ceil((Math.random() * 0.20) * pointsMax)
                if(toSpend > points){
                    toSpend = points
                } 
                if(unitScalar){
                    toSpend = Math.ceil(toSpend * unitScalar[stats[i]])
                }
                unit.stats[stats[i]] += toSpend
                unit.stats[stats[i]] = Math.floor(unit.stats[stats[i]])
                points -= toSpend
                spent += toSpend
            }
        }   
        for(var i = 0; i < stats.length; i++){
            statTotal += unit.stats[stats[i]] - 5
        }
        if(unit.level == 0){
            if(Math.floor(statTotal/8) < 1){
                unit.level = 1
            } else {
                unit.level = Math.floor(statTotal/8)
            }
        }
        return simulateCPUStanceAssign(unit)
    },
    parseReward(drop,player,mob){
        return parseReward(drop,player,mob)
    },
    generateRNGEquipment(dropData,SP){
        return generateRNGEquipment(dropData,SP)
    },
    generateRNGAbility(abilityData,forcedFields){
        return generateRNGAbility(abilityData,forcedFields)
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
            let result;
            switch(data.status.type){
                //resource bundle
                case 0:
                    let resource = ["wood","food","minerals"][Math.floor(Math.random() * 3)]
                    let amount = val * 2
                    data.townResources[resource] += amount
                    message += "\nYou received " + amount + " " + resource
                    break;
                
                //gold
                case 1:
                    result = parseReward({
                        type:"resource",
                        resource:"gold",
                        resourceName: "gold",
                        amount: val * 5
                    }, player)
                    player = result[0]

                    if(!data.resources){
                        data.resources = {
                            gold:val * 5
                        }
                    } else {
                        if(!data.resources.gold){
                            data.resources.gold = val * 5
                        } else {
                            data.resources.gold += val * 5
                        }
                    }
    
                    if(result[1].length > 0){
                        for(msg of result[1]){
                            message += "\n" + msg 
                        }
                    }
                    break;

                //exp
                case 2:
                    result = parseReward({
                        type:"resource",
                        resource:"exp",
                        resourceName: "experience",
                        amount: val * 40
                    }, player)
                    player = result[0]

                    if(!data.resources){
                        data.resources = {
                            exp:val * 40
                        }
                    } else {
                        if(!data.resources.exp){
                            data.resources.exp = val * 40
                        } else {
                            data.resources.exp += val * 40
                        }
                    }
    
                    if(result[1].length > 0){
                        for(msg of result[1]){
                            message += "\n" + msg 
                        }
                    }
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
                                lockStatTypes: false,
                                baseVal: 5 * val,
                                types: ["weapon","gear"]
                            }
                        }
                    }
                    result = parseReward(newData, player)
                    player = result[0]
    
                    if(!data.rewardMessages){
                        data.rewardMessages = [result[1][0]]
                    } else {
                        if(!data.rewardMessages){
                            data.rewardMessages = [result[1][0]]
                        } else {
                            data.rewardMessages.push(result[1][0])
                        }
                    }
                    
                    if(result[1].length > 0){
                        for(msg of result[1]){
                            message += "\n" + msg 
                        }
                    }
                    break;
                
                //abilitypoints
                case 4:
                    result = parseReward({
                        type:"resource",
                        resource:"abilitypoints",
                        resourceName: "ability points",
                        amount: val * 3
                    }, player)
                    player = result[0]

                    if(!data.resources){
                        data.resources = {
                            abilityPoints:val * 3
                        }
                    } else {
                        if(!data.resources.abilityPoints){
                            data.resources.abilityPoints = val * 3
                        } else {
                            data.resources.abilityPoints += val * 3
                        }
                    }
    
                    if(result[1].length > 0){
                        for(msg of result[1]){
                            message += "\n" + msg 
                        }
                    }
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
    applyTownReputation(town,id,amount){
        if(!town.reputations){
            town.reputations = {}
            town.reputations[id] = amount
        } else {
            if(!town.reputations[id]){
                town.reputations[id] = amount
            } else {
                town.reputations[id] += amount
            }
        }
    },
    capitalize(text){
        return text.charAt(0).toUpperCase() + text.slice(1);
    }
}