const { statChangeStages ,raidPresets, quests, statIncreaseRatios, factionMatchups, innateFacilities, acquiredFacilities, abilityWeights } = require("./data.json");
const { MessageActionRow, MessageSelectMenu, MessageButton, MessageEmbed } = require('discord.js');
const { clone, createAbilityDescription, runEnemyCombatAI, printEquipmentDisplay, parseReward, weightedRandom, msToTime, prepCombatFighter, calculateAbilityCost, simulateCPUAbilityAssign, simulateCPUSPAssign, generateRNGEquipment, givePlayerItem} = require("./tools.js");
const { stat } = require("fs");
const { getTownDBData } = require("./firebaseTools.js")
 
function eventComparator(e,data){
    let match = true
    if(e.data.staticData){
        for(t in e.data.staticData){
            if(e.data.staticData[t] != data.data.staticData[t]){
                match = false
            }
        }
    }
    if(e.data.records){
        for(t in e.data.records){
            if(e.data.records[t] != data.data.records[t]){
                match = false
            }
        }
    }
    let excludes = ["staticData","records"]
    for(t in e.data){
        if(!excludes.includes(t)){
            if(e.data[t] != data.data[t]){
                match = false
            }
        }
    }
    return match
}

function triggerCombatEvent(data,session){
    if(session.session_data.options.events){
        switch(data.type){
            //Turn Trigger
            case 0:
                for(e of session.session_data.options.events){
                    if(e.type == data.type){
                        if(e.data.count == session.session_data.turn){
                            activateCombatTriggers(e.result,session)
                        } else if(e.data.min <= session.session_data.turn && e.data.max >= session.session_data.turn){
                            activateCombatTriggers(e.result,session)    
                        } else if (e.data.all){
                            activateCombatTriggers(e.result,session) 
                        }
                    }
                }
                break;

            //Fighter Death Trigger
            case 1:
                for(e of session.session_data.options.events){
                    if(e.type == data.type){
                        if(eventComparator(e,data)){
                            activateCombatTriggers(e.result,session)
                        }
                    }
                }
                break;
            
            //Fighter Attacked Trigger
            case 2:
                for(e of session.session_data.options.events){
                    if(e.type == data.type){
                        if(eventComparator(e,data)){
                            activateCombatTriggers(e.result,session)
                        }
                    }
                }
                break;

            //Repeating Turn Trigger
            case 3:
                for(e of session.session_data.options.events){
                    if(e.type == data.type){
                        if(session.session_data.turn % e.data.count == 0){
                            activateCombatTriggers(e.result,session)
                        } else if(e.data.min <= session.session_data.turn && e.data.max >= session.session_data.turn){
                            activateCombatTriggers(e.result,session)    
                        } else if (e.data.all){
                            activateCombatTriggers(e.result,session) 
                        }
                    }
                }
                break;
        }
    }
}

function activateCombatTriggers(triggerName,session){
    if(session.session_data.options.triggers){
        for(t in session.session_data.options.triggers){
            if(t == triggerName){
                let triggerData = session.session_data.options.triggers[t]
                switch(triggerData.actionType){
                    case 0:
                        let unitData = weightedRandom(triggerData.data.units)
                        let newUnit = clone(unitData.unit)
                        if(!unitData.scaling){
                            newUnit = simulateCPUAbilityAssign(newUnit,[],unitData.allowance)
                            newUnit = simulateCPUSPAssign(newUnit,unitData.skillpoints)
                        } else {
                            switch(unitData.scaling){
                                case "dungeon":
                                    newUnit = simulateCPUAbilityAssign(newUnit,[],unitData.allowance * (session.linkedSession_data.dungeonRank + session.linkedSession_data.dangerValue/8))
                                    newUnit = simulateCPUSPAssign(newUnit,Math.ceil((session.linkedSession_data.dungeonRank + session.linkedSession_data.dangerValue/8) * 60),unitData.scalar)
                                    break;
                            }
                        }
                        let fighterData = prepCombatFighter(newUnit,session.session_data.fighters.length)
                        if(unitData.alliance){
                            fighterData.team = unitData.alliance
                        }
                        session.session_data.battlelog.alerts.push(fighterData.staticData.name + " has entered combat!")
                        session.session_data.fighters.push(fighterData)
                        break;
                }
            }
        }
    }
    switch(triggerName.split("_")[0]){
        case "win":
            let winningTeam = parseInt(triggerName.split("_")[1])
            let winnersAlive = false
            for(fighter of session.session_data.fighters){
                if(fighter.team == winningTeam){
                    if(fighter.alive){
                        winnersAlive = true
                    }
                }
            }
            if(winnersAlive){
                for(fighter of session.session_data.fighters){
                    if(fighter.team != winningTeam){
                        fighter.forfeit = true;
                        fighter.customForfeit = "Failed Objective"
                    }
                }
                let teamDict = ["🟢","🔴​","🟠​","🟡","​🔵","🟣"]
                session.session_data.battlelog.alerts.push("Team "  + teamDict[winningTeam] + " has achieved their objective!")
            }
            break;

        case "dialogue":
            session.session_data.battlelog.dialogue.push(session.session_data.options.dialogue[triggerName.split("_")[1]])
            break;
    }
}

function checkActiveCombatants(session){
    let present = [];
    let presentTeams = []
    for(fighter of session.session_data.fighters){
        if(!fighter.forfeit && fighter.alive){
            if(!present.includes(fighter.index)){
                present.push(fighter.index)
            }
            if(!presentTeams.includes(fighter.team) && fighter.team != null){
                presentTeams.push(fighter.team)
            }
        }
        fighter.guardData = "none"
    }
    if(present.length == 1){
        session.session_data.completed = true
        session.session_data.winners.push(session.session_data.fighters[present[0]].staticData.id)
    } else if (presentTeams.length == 1){
        session.session_data.completed = true
        for(i in session.session_data.fighters){
            let fighter = session.session_data.fighters[i]
            if(fighter.team == presentTeams[0]){
                session.session_data.winners.push(fighter.staticData.id)
            }
        }
    }

    if(!session.session_data.completed){
        let NonCPUPlayersLeft = []
        for(fighter of session.session_data.fighters){
            if(fighter.alive && fighter.staticData.cpu == undefined){
                NonCPUPlayersLeft.push(fighter.staticData.id)
            }
        }
    
        if(NonCPUPlayersLeft.length == 0){
            session.session_data.completed = true   
            session.session_data.battlelog.alerts.push("No Players Remaining: Combat Ended")
        }
    }
}

function getAbilityOrder(fighters){
    let abilityOrder = [
        [],
        [],
        [],
        [],
        []
    ]

    for(fighter of fighters){
        if(fighter.staticData.abilities){
            if(fighter.alive && fighter.choosenAbility != -2 && fighter.staticData.abilities.length > 0){
                let choosenData = fighter.staticData.abilities[fighter.choosenAbility]
                let targets = []
                switch(choosenData.action_type){
                    case "attack":
                        switch(parseInt(choosenData.targetType)){
                            case 1:
                                targets = [fighter.target]
                                break;
                            
                            case 2:
                                for(f in fighters){
                                    if(fighters[f].team != fighter.team){
                                        targets.push(f)
                                    }
                                }
                                break;
                            case 3:
                                for(f in fighters){
                                    if(fighters[f].index != fighter.index){
                                        targets.push(f)
                                    }
                                }
                                break;
                        }
                        break;
                }
                abilityOrder[choosenData.speed].push({
                    index:fighter.index,
                    ability:choosenData,
                    targets:targets
                })
            }
        }
    }

    for(speedTier of abilityOrder){
        speedTier = speedTier.sort(function(a,b){
            if(fighters[a.index].liveData.stats.spd * statChangeStages[fighters[a.index].liveData.statChanges.spd]  == fighters[b.index].liveData.stats.spd * statChangeStages[fighters[b.index].liveData.statChanges.spd]){
                return Math.random() > 0.5 ? 1 : -1;
            }
            if(fighters[a.index].liveData.stats.spd * statChangeStages[fighters[a.index].liveData.statChanges.spd]  < fighters[b.index].liveData.stats.spd * statChangeStages[fighters[b.index].liveData.statChanges.spd]){
                return 1;
            } else {
                return -1
            }
        })
    }

    return abilityOrder
}

function processMobRewards(mob,session){
    if(session.session_data.options.rewardPlayer != false){
        let fighters = session.session_data.fighters
        for(fighter of fighters){
            if(fighter.team != mob.team && !fighter.staticData.cpu){
                let expReward = Math.ceil(mob.staticData.level * 12.5)
                let result = parseReward({
                    type:"resource",
                    resource:"exp",
                    resourceName: "experience",
                    amount: expReward
                }, fighter.staticData)
                fighter.staticData = result[0]

                if(result[1].length > 0){
                    for(msg of result[1]){
                        session.session_data.battlelog.rewards.push(msg)
                    }
                }

                if(mob.staticData.droptable){
                    let drop = weightedRandom(mob.staticData.droptable)
                    result = parseReward(drop,fighter.staticData,mob)
                    if(result[2]){
                        switch(result[2].type){
                            case "gear":
                                fighter.records.gearLooted++
                                break;

                            case "weapon":
                                fighter.records.weaponsLooted++
                                break;
                        }
                    }
                    fighter.staticData = result[0]
                    if(result[1].length > 0){
                        for(msg of result[1]){
                            session.session_data.battlelog.rewards.push(msg)
                        }
                    }
                }
            }
        }
    }
}

function calculateAttackDamage(level,atkStat,defStat,baseDamage){
    let levelMod = ((2 * level)/5) + 2
    let statMod = baseDamage * (atkStat/defStat)
    return Math.ceil((levelMod * statMod)/50)
}

function playerQuestScript(questData,session){
    let storyContent = questData.script[session.session_data.questStep]
            
    if(questData.scriptFiller[session.session_data.questStep]){
        for(var i = 0; i < questData.scriptFiller[session.session_data.questStep].length; i++){
            let fillData = questData.scriptFiller[session.session_data.questStep][i]
            let fillLine;
            switch(fillData.path.type){
                case "single": 
                        fillLine = session.session_data[fillData.getValFrom][fillData.path.pathString]
                    break;
                case "nested":
                        let pointer = clone(fillData.path);
                        let point = clone(session.session_data[fillData.getValFrom])
                        while(pointer.path){
                            point = point[pointer.path]
                            if(pointer.nextNested){
                                pointer = pointer.nextNested 
                            } else {
                                break;
                            }
                        }
                        fillLine = point
                    break;
            }
            
            if(fillData.converter){
                if(fillData.converter[fillLine]){
                    fillLine = fillData.converter[fillLine]
                }
            }

            storyContent = storyContent.split("FILLER-" + i).join(fillLine)
        }
    }

    if(questData.actionPlan[session.session_data.questStep].data.question){
        storyContent += "\n\n---\n\n" + questData.actionPlan[session.session_data.questStep].data.question
    }
    if(questData.actionPlan[session.session_data.questStep].data.important){
        storyContent += "\n\n" + "Warning: " + questData.actionPlan[session.session_data.questStep].data.important
    }
    if(questData.actionPlan[session.session_data.questStep].data.ending){
        storyContent += "\n\n-QUEST COMPLETE-\n\n" + questData.actionPlan[session.session_data.questStep].data.ending
    }

    return "```diff\n" + storyContent + "```"
}


module.exports = {
    populateCloseInteractionMessage(message,nonDismiss){
        const embed = new MessageEmbed()
			.setColor('#00ff00')
			.setTitle(message)

        if(nonDismiss == undefined){
			embed.setDescription('You can now dismiss this message');
        }
        return {
            content: " ",
            components: [],
            embeds: [embed]
        }
    },
    populateStatEditWindow (session){
        let statDescriptions = {
            "hp": "Total Hitpoints",
            "atk": "Increases damage done by physical attacks",
            "spatk": "Increases damage done by special attacks",
            "def": "Decreases damage taken from physical attacks",
            "spdef": "Decreases damage taken from physical attacks",
            "spd": "Determines how quickly you will preform abilities",
        }
        
        let displayText = "```diff\n"
        displayText += "Statpoints to spend: " + session.session_data.statpoints + "\n\n"
        for(statname in session.session_data.stats){
            if(session.session_data.stats[statname] < session.session_data.prevStats[statname]){
                displayText += "-"
            }else if(session.session_data.stats[statname] > session.session_data.prevStats[statname]){
                displayText += "+"
            } 
            displayText += statname + " (" + statDescriptions[statname] + "): " + session.session_data.stats[statname] 
            let statpointsNeeded;
            if(session.session_data.faction != -1){
                if(statIncreaseRatios[session.session_data.faction][statname] > 0){
                    statpointsNeeded = 1
                } else {
                    statpointsNeeded = 1/statIncreaseRatios[session.session_data.faction][statname]
                }
            } else {
                statpointsNeeded = 1
            }
            if(statname == session.session_data.editingStat){
                if(session.session_data.faction != -1){
                    displayText += " (-/+) " + statIncreaseRatios[session.session_data.faction][statname] + ": Refunds/Costs " + statpointsNeeded 
                } else {
                    displayText += " (-/+) 1: Refunds/Costs " + statpointsNeeded 
                }
                
                if(statpointsNeeded > 1){
                    displayText += + " statpoints"
                } else {
                    displayText += " statpoint"
                }
                
            }
            displayText += "\n"
        }
        displayText += "\nUse the </> arrows to decrease/increase a stat\n"
        displayText += "\n```"
        return displayText
    },
    populateStatEditButtons(session){
        let selectionLabels = []

        for(statname in session.session_data.stats){
            selectionLabels.push({
                label: statname,
                description: "Select this to edit your character's " + statname + " stat",
                value: statname,
            })
        }

        const row1 = new MessageActionRow()
            .addComponents(
                new MessageSelectMenu()
                    .setCustomId('selectStat_' + session.session_id)
                    .setPlaceholder('Select a stat to change')
                    .addOptions(selectionLabels),
                    
            );
        
        let canIncrease = true;
        let canDecrease = true; 
        if(session.session_data.editingStat != "none"){
            if(session.session_data.prevStats[session.session_data.editingStat] < session.session_data.stats[session.session_data.editingStat]){
                canDecrease = false;
            }
            let statpointsNeeded;
            let stat = session.session_data.editingStat

            if(session.session_data.faction != -1){
                if(statIncreaseRatios[session.session_data.faction][stat] > 0){
                    statpointsNeeded = 1
                } else {
                    statpointsNeeded = 1/statIncreaseRatios[session.session_data.faction][stat]
                }
            } else {
                statpointsNeeded = 1
            }
            if(session.session_data.statpoints >= statpointsNeeded){
                canIncrease = false;
            }
        }
        const row2 = new MessageActionRow()
            .addComponents(
                    new MessageButton()
                    .setCustomId('decreaseStat_' + session.session_id)
                    .setLabel('<')
                    .setStyle('DANGER')
                    .setDisabled(canDecrease),

                    new MessageButton()
                    .setCustomId('increaseStat_' + session.session_id)
                    .setLabel('>')
                    .setStyle('SUCCESS')
                    .setDisabled(canIncrease),

                    new MessageButton()
                    .setCustomId('saveStats_' + session.session_id)
                    .setLabel('Save')
                    .setStyle('PRIMARY'),

                    new MessageButton()
                    .setCustomId('cancel_' + session.session_id)
                    .setLabel('Cancel')
                    .setStyle('DANGER')
            );
        return [row1,row2]
    },
    populateCombatControls(session){
        const row1 = new MessageActionRow()
        .addComponents(
                new MessageButton()
                .setCustomId('ability_' + session.session_id + '_0')
                .setLabel('Ability 1')
                .setStyle('SUCCESS'),

                new MessageButton()
                .setCustomId('ability_' + session.session_id + '_1')
                .setLabel('Ability 2')
                .setStyle('SUCCESS'),

                new MessageButton()
                .setCustomId('ability_' + session.session_id + '_2')
                .setLabel('Ability 3')
                .setStyle('SUCCESS')
        );

        if(session.session_data.options.canFlee){
            row1.addComponents(
                new MessageButton()
                .setCustomId('flee_' + session.session_id)
                .setLabel('Flee')
                .setStyle('DANGER')
            )
        }
        const row2 = new MessageActionRow()
        .addComponents(
                new MessageButton()
                .setCustomId('ability_' + session.session_id + '_3')
                .setLabel('Ability 4')
                .setStyle('SUCCESS'),

                new MessageButton()
                .setCustomId('ability_' + session.session_id + '_4')
                .setLabel('Ability 5')
                .setStyle('SUCCESS'),

                new MessageButton()
                .setCustomId('ability_' + session.session_id + '_5')
                .setLabel('Ability 6')
                .setStyle('SUCCESS'),

                new MessageButton()
                .setCustomId('myAbilities_' + session.session_id)
                .setLabel('My Fighter')
                .setStyle('PRIMARY')
        );

        if(session.session_data.fighters.length > 2){
            let selectionLabels = []
            
            for(fighter of session.session_data.fighters){
                if(fighter.alive){
                    selectionLabels.push({
                        label: "Target " + fighter.staticData.name,
                        description: "Set " + fighter.staticData.name + " As Your Target",
                        value: "" + fighter.index,
                    })
                }
            }

            const row3 = new MessageActionRow()
            .addComponents(
                new MessageSelectMenu()
                    .setCustomId('selectTarget_' + session.session_id)
                    .setPlaceholder('Select a Target')
                    .addOptions(selectionLabels),
            )
            return [row1,row2,row3]
        } else {
            return [row1,row2]
        }
        
    },
    populateCombatWindow(session){
        let fightData = session.session_data
        let title = ""
        if(session.session_data.options.quest){
            title = session.session_data.options.quest.title
        } else {
            if(session.session_data.turn == 0){
                title += "Waiting to begin"
            } else {
                if(session.session_data.completed){
                    title += "Turn #" + session.session_data.turn  + " - Battle Comlpeted"
                } else {
                    title += "Turn #" + session.session_data.turn 
                }
                
            }

            if(fightData.fighters.length < 3){
                title += ": " + fightData.fighters[0].staticData.name + " vs " + fightData.fighters[1].staticData.name
            } else {
                title += ": Mult-Duel (" + fightData.fighters.length + " combatants)"
            }
        }
        const embed = new MessageEmbed()
			.setColor("#7289da")
			.setTitle(title)

        if(session.session_data.options.quest){
            embed.addField("Story",session.session_data.options.quest.entryText)
        }

        for(fighter of fightData.fighters){
            if(!fighter.hide){
                if(!fighter.alive){
                    fighter.hide = true
                }
                let emojiHealthbar = ""
                let hpRatio = Math.floor((fighter.liveData.stats.hp / fighter.liveData.maxhp)*8) 

                let teamDict = ["🟢","🔴​","🟠​","🟡","​🔵","🟣"]
                let character = ""
                
                let defVal = fighter.liveData.stats.def * statChangeStages[fighter.liveData.statChanges.def]
                let spdefVal = fighter.liveData.stats.spdef * statChangeStages[fighter.liveData.statChanges.spdef]
                if(defVal > spdefVal * 1.25){
                    character = "🟫"
                } else if(spdefVal > +defVal * 1.25){
                    character = "🟪"
                } else {
                    character = "🟩"
                }

                for(let i = 1; i <= hpRatio;i++){
                    emojiHealthbar += character
                }
                for(let i = 1; i <= 8 - hpRatio;i++){
                    emojiHealthbar += "🔲"
                }
                let hearts = ""
                if(fighter.alive){
                    for(var i = 0; i < fighter.staticData.lives;i++){
                        hearts += "❤️"
                    }
                }
                let fighterDesc = fighter.liveData.stats.hp + "/" + fighter.liveData.maxhp + " | " + hearts + "\n" + emojiHealthbar
                if(!fighter.alive){
                    fighterDesc += "\n💀 **DEAD** 💀"
                } else if(session.session_data.winners.includes(fighter.staticData.id)){
                    fighterDesc += "\n**Winner**"
                } else if(fighter.choosenAbility > -1){
                    if(fighter.staticData.cpu){
                        switch(fighter.staticData.abilities[fighter.choosenAbility].action_type){
                            case "attack":
                                fighterDesc += "\n**Preparing to attack...**"
                                break;
                            
                            case "guard":
                                fighterDesc += "\n**Preparing to guard...**"
                                break;

                            case "stats":
                                fighterDesc += "\n**Preparing to modify stats...**"
                                break;
                        }
                    } else {
                        fighterDesc += "\n**Ready**"
                    }
                } else if (fighter.forfeit){
                    if(fighter.customForfeit){
                        fighterDesc += "\n**" + fighter.customForfeit + "**"
                    } else {
                        fighterDesc += "\n**Fled from battle**"
                    }
                } else if (!fighter.staticData.abilities || fighter.staticData.abilities.length < 1){
                    fighterDesc += "\n*Cannot Act*"
                } else {
                    fighterDesc += "\n*Choosing next action...*"
                }
                if(fighter.team != null){
                    embed.addField(teamDict[fighter.team] + fighter.staticData.name + " - Lvl " + fighter.staticData.level, fighterDesc, true)
                } else {
                    embed.addField(fighter.staticData.name + " - Lvl " + fighter.staticData.level, fighterDesc, true)
                }
            }
        }
        if(session.session_data.battlelog.dialogue.length > 0){
            let log = ""
            for(action of session.session_data.battlelog.dialogue){
                log += action += "\n"
            }
            embed.addField(
                "Dialogue",
                "```diff\n" + log + "```"
            )
        }
        if(session.session_data.battlelog.alerts.length > 0){
            let log = ""
            for(action of session.session_data.battlelog.alerts){
                log += action += "\n"
            }
            embed.addField(
                "Alert Log",
                "```diff\n" + log + "```"
            )
        }
        if(session.session_data.battlelog.combat.length > 0){
            let log = ""
            for(action of session.session_data.battlelog.combat){
                log += action += "\n"
            }
            embed.addField(
                "Battle Log",
                "```diff\n" + log + "```"
            )
        } else {
            embed.addField(
                "Battle Log",
                "```diff\nWaiting for actions to be declared...```"
            )
        }
        if(session.session_data.battlelog.rewards.length > 0){
            let log = ""
            for(action of session.session_data.battlelog.rewards){
                log += action += "\n"
            }
            embed.addField(
                "Reward Log",
                "```diff\n" + log + "```"
            )
        }

        session.session_data.battlelog.dialogue = []
        session.session_data.battlelog.combat = []
        session.session_data.battlelog.rewards = []
        session.session_data.battlelog.alerts = []
        return [embed];
    },
    populateCombatData(fighters,options){
        let data = {
            options:options,
            fighters:[],
            turn:0,
            battlelog:{
                dialogue:[],
                combat:[],
                rewards:[],
                alerts:[]
            },
            completed:false,
            winners:[]
        }
    

        let i = 0;
        for(let fighter of fighters){
            let fighterData = prepCombatFighter(fighter,i)
            if(options.alliances){
                fighterData.team = options.alliances[i]
            }
            data.fighters.push(fighterData)
            i++;
        }

        if(options.openingDialogue != undefined){
            data.battlelog.dialogue.push(data.options.dialogue[options.openingDialogue])
        }
        return data;
    },
    processCombatSession(session){
        let simTurn = true 
        let fighters = session.session_data.fighters
        for(var i = 0; i < fighters.length;i++){
            session.session_data.fighters[i].hasActed = false
        }
        for(var i = 0; i < fighters.length;i++){
            let fighter = session.session_data.fighters[i]
            if(fighter.alive){
                if(fighter.staticData.abilities){
                    if(fighter.choosenAbility == -1 && fighter.staticData.abilities.length > 0){
                        simTurn = false
                        break;
                    }
                }
            }
        }
        if(simTurn){
            let first = true
            let schedule = getAbilityOrder(fighters).reverse()
            if(session.session_data.turn == 0){
                for(var i = 0; i < fighters.length;i++){
                    let fighter = session.session_data.fighters[i]
                    if(fighter.weaponPassives[3] > 0 && Math.random() < fighter.weaponPassives[3] * 0.15){
                        schedule[0].push({
                            index:fighter.index,
                            ability:{
                                "action_type": "stats",
                                "name": "Daunting Display",
                                "statChangeCount": 2,
                                "effects": [
                                  {
                                    "target": "4",
                                    "stat": "atk",
                                    "value": -1
                                  },
                                  {
                                    "target": "4",
                                    "stat": "spatk",
                                    "value": -1
                                  }
                                ],
                                "speed": 1
                              },
                            targets:[]
                        })
                    }
                    if(fighter.gearPassives[3] > 0 && Math.random() < fighter.gearPassives[3] * 0.15){                    
                        schedule[0].push({
                            index:fighter.index,
                            ability:{
                                "action_type": "stats",
                                "name": "Supreme Stature",
                                "statChangeCount": 2,
                                "effects": [
                                  {
                                    "target": "4",
                                    "stat": "def",
                                    "value": -1
                                  },
                                  {
                                    "target": "4",
                                    "stat": "spdef",
                                    "value": -1
                                  }
                                ],
                                "speed": 1
                              },
                            targets:[]
                        })
                    }
                }
            }
            for(timePeriod of schedule){
                for(action of timePeriod){
                    let actionCode;
                    let weaponPassives = session.session_data.fighters[action.index].weaponPassives;

                    let gearPassives = session.session_data.fighters[action.index].gearPassives;               
                    switch(action.ability.action_type){
                        case "attack":
                            let attacker = session.session_data.fighters[action.index]                  
                            if(attacker.alive){
                                if(first){
                                    attacker.records.timesFirstAttack++
                                    first = false
                                }
                                if(action.targets.length > 1){
                                    actionCode = attacker.index + "_" + action.ability.name + "_" + action.ability.targetType
                                } else {
                                    actionCode = attacker.index + "_" + action.ability.name + "_" + action.ability.targetType + "_" + action.targets[0]
                                }   

                                let abilityUseNotif = attacker.staticData.name + " used " + action.ability.name + " on "
                                

                                for(i in action.targets){
                                    if(session.session_data.fighters[action.targets[i]].alive){
                                        abilityUseNotif += session.session_data.fighters[action.targets[i]].staticData.name
                                        if(i < action.targets.length - 2){
                                            abilityUseNotif += ", "
                                        } else if(i == action.targets.length - 2){
                                            abilityUseNotif += " and "
                                        }
                                    }
                                }

                                session.session_data.battlelog.combat.push(abilityUseNotif)

                                for(t of action.targets){

                                    let target = session.session_data.fighters[t]

                                    if(target.alive && !target.forfeit){

                                        let attackNum = action.ability.numHits
                                        let multiHit = false
                                        let multiDamage = 0
                                        if(attackNum > 1){
                                            multiHit = true
                                        }
                                        let hitCount = 0
                                        let critCount = 0
                                        while(attackNum > 0){
                                            let attackBase = action.ability.damage_val
                                            
                                            let accCheck = Math.floor(Math.random() * 100) 

                                            let repeatPenal = 0;
                                            if(!target.staticData.object){
                                                if(attacker.lastAction == actionCode){
                                                    attacker.repeats++
                                                    repeatPenal = 10 * attacker.repeats
                                                } else {
                                                    attacker.repeats = 0
                                                }

                                                if(target.guardData != "none" || target.guardData == "fail"){
                                                    repeatPenal = 0
                                                }
                                            }
                                           
                                            let hitConfirm = accCheck < (action.ability.accuracy - repeatPenal)
                                            if(hitConfirm){
                                                hitCount++
                                                switch(action.ability.damage_type){
                                                    case "atk":
                                                        attacker.records.attacks++
                                                        break;

                                                    case "spatk":
                                                        attacker.records.spattacks++
                                                        break;
                                                }
                                                
                                                if(target.guardData != "none" && target.guardData != "fail"){
                                                    attackNum = 0
                                                    let guardValue = target.guardData.guard_val
                                                    switch(target.guardData.guard_type){
                                                        case "def":
                                                            target.records.guards++
                                                            break;
    
                                                        case "spdef":
                                                            target.records.spguards++
                                                            break;
                                                    }
                                                    let typeMatch = {
                                                        "atk":"def",
                                                        "spatk":"spdef"
                                                    }
                                                    if(typeMatch[action.ability.damage_type] != target.guardData.guard_type){
                                                        let mismatchVal = 0.5
                                                        if(target.gearPassives[4] > 0){
                                                            mismatchVal += target.gearPassives[4] * 0.07
                                                        }
                                                        guardValue *= mismatchVal
                                                        attackBase -= guardValue
                                                        target.records.baseDamageBlocked += guardValue
                                                        if(attackBase <= 0){
                                                            let healAmount = 0
                                                            if(target.gearPassives[1] > 0){
                                                                healAmount = Math.ceil(Math.abs(attackBase) * (target.gearPassives[1] * 0.2))
                                                            }
                                                            target.liveData.stats.hp += healAmount
                                                            if(target.liveData.stats.hp > target.liveData.maxhp){
                                                                target.liveData.stats.hp = target.liveData.maxhp
                                                            }
                                                            attackBase = 0
                                                            let notice = target.staticData.name + " was able to block the attack"
                                                            if(healAmount > 0){
                                                                notice += " and healed " + healAmount + " health"
                                                            }
                                                            session.session_data.battlelog.combat.push(notice + "!")
                                                            target.records.timesBlocked++
                                                            target.records.completeBlocks++
                                                            if(target.gearPassives[5] > 0){
                                                                if(Math.random() < target.gearPassives[5] * .05){
                                                                    let stats = ["atk","spatk","def","spdef","spd"]
                                                                    let choosenStat = stats[Math.floor(Math.random() * stats.length)]
                                                                    target.liveData.statChanges[choosenStat] += 1
                                                                    let msg;
                                                                    if(target.liveData.statChanges[choosenStat] > 16){
                                                                        target.liveData.statChanges[choosenStat] = 16
                                                                        msg = target.staticData.name + "'s " + choosenStat + " multiplier can't go higher!"
                                                                    } else {
                                                                        msg = target.staticData.name + "'s " + choosenStat + " multiplier increased by 1 stage (x" + statChangeStages[target.liveData.statChanges[effect.stat]] + ")."
                                                                    }
                                                                    session.session_data.battlelog.combat.push(msg)
                                                                }
                                                            }
                                                        } else {
                                                            target.records.timesBlocked++
                                                            session.session_data.battlelog.combat.push(target.staticData.name + " was able to block some of the damage!")
                                                        }
                                                    } else {
                                                        let healAmount = 0 
                                                        attackBase -= guardValue
                                                        target.records.baseDamageBlocked += guardValue
                                                        let notice;
                                                        if(attackBase <= 0){
                                                            if(target.gearPassives[1] > 0){
                                                                healAmount = Math.ceil(Math.abs(attackBase) * (target.gearPassives[1] * 0.2))
                                                            }
                                                            target.liveData.stats.hp += healAmount
                                                            if(target.liveData.stats.hp > target.liveData.maxhp){
                                                                target.liveData.stats.hp = target.liveData.maxhp
                                                            }
                                                            attackBase = 0
                                                            notice = target.staticData.name + " blocked the attack"
                                                            target.records.timesBlocked++
                                                            target.records.completeBlocks++
                                                            if(target.gearPassives[5] > 0){
                                                                if(Math.random() < target.gearPassives[5] * .05){
                                                                    let stats = ["atk","spatk","def","spdef","spd"]
                                                                    let choosenStat = stats[Math.floor(Math.random() * stats.length)]
                                                                    target.liveData.statChanges[choosenStat] += 1
                                                                    let msg;
                                                                    if(target.liveData.statChanges[choosenStat] > 16){
                                                                        target.liveData.statChanges[choosenStat] = 16
                                                                        msg = target.staticData.name + "'s " + choosenStat + " multiplier can't go higher!"
                                                                    } else {
                                                                        msg = target.staticData.name + "'s " + choosenStat + " multiplier increased by 1 stage (x" + statChangeStages[target.liveData.statChanges[effect.stat]] + ")."
                                                                    }
                                                                    session.session_data.battlelog.combat.push(msg)
                                                                }
                                                            }
                                                        } else {
                                                            notice = target.staticData.name + " blocked some of the damage"
                                                            target.records.timesBlocked++
                                                        }
                                                        if(target.guardData.counter_val > 0){
                                                            let guard = target.guardData
                                                            let counterDamage = Math.floor(calculateAttackDamage(
                                                                target.staticData.level,
                                                                target.staticData.stats[guard.counter_type] * statChangeStages[target.liveData.statChanges[guard.counter_type]],
                                                                attacker.staticData.stats[guard.counter_type] * statChangeStages[attacker.liveData.statChanges[guard.counter_type]],
                                                                guard.counter_val
                                                            ))

                                                            
                                                            
                                                            if(counterDamage > 0){
                                                                if(healAmount > 0){
                                                                    notice += ", healed " + healAmount + " health"
                                                                }
                                                                session.session_data.battlelog.combat.push(notice + " and followed up with a counter attack!")
                
                                                                if(target.gearPassives[0] > 0){
                                                                    if(Math.random() < target.gearPassives[0] * .1){
                                                                        counterDamage *= 2
                                                                    }
                                                                }

                                                                attacker.records.timesHit++
                                                                attacker.liveData.stats.hp -= counterDamage;
                                                                attacker.records.enemyDamageTaken += counterDamage;
                                                                target.records.counterDamageDone += counterDamage
                                                                session.session_data.battlelog.combat.push(attacker.staticData.name + " took " + counterDamage + " damage")
                                                                if(attacker.liveData.stats.hp <= 0){
                                                                    attacker.staticData.lives -= 1
                                                                    if(attacker.staticData.lives <= 0){
                                                                        attackNum = 0
                                                                        attacker.liveData.stats.hp = 0
                                                                        attacker.alive = false
                                                                        target.records.unitsDefeated++
                                                                        attacker.attacker = -1
                                                                        attacker.choosenAbility = -2
                                                                        session.session_data.battlelog.combat.push(attacker.staticData.name + " was defeated!")
                                                                        attacker.staticData.lives = 1
                                                                        if(attacker.staticData.cpu){
                                                                            processMobRewards(attacker,session)
                                                                        }
                                                                        triggerCombatEvent({
                                                                            type:1,
                                                                            data:attacker
                                                                        },session)
                                                                        if(attacker.staticData.rareVar){
                                                                            target.records.raresDefeated++
                                                                        }
                                                                    } else {
                                                                        session.session_data.battlelog.combat.push(attacker.staticData.name + " lost a life! (" + attacker.staticData.lives + " remaining)")
                                                                        attacker.liveData.stats.hp = attacker.staticData.stats.hp
                                                                    }
                                                                }
                                                            } else {
                                                                if(healAmount > 0){
                                                                    notice += " and healed " + healAmount + " health"
                                                                }
                                                                session.session_data.battlelog.combat.push(notice +"!")
                                                            }
                                                        } else {
                                                            if(healAmount > 0){
                                                                notice += " and healed " + healAmount + " health"
                                                            }
                                                            session.session_data.battlelog.combat.push(notice +"!")
                                                        }
                                                    }
                                                } else if (weaponPassives[2] > 0 && Math.random() < 0.05 * weaponPassives[2]) {
                                                    let stats = ["atk","spatk","def","spdef","spd"]
                                                    let choosenStat = stats[Math.floor(Math.random() * stats.length)]
                                                    attacker.liveData.statChanges[choosenStat] += 1
                                                    let msg;
                                                    if(attacker.liveData.statChanges[choosenStat] > 16){
                                                        attacker.liveData.statChanges[choosenStat] = 16
                                                        msg = attacker.staticData.name + "'s " + choosenStat + " multiplier can't go higher!"
                                                    } else {
                                                        msg = attacker.staticData.name + "'s " + choosenStat + " multiplier increased by 1 stage (x" + statChangeStages[attacker.liveData.statChanges[choosenStat]] + ")."
                                                    }
                                                    session.session_data.battlelog.combat.push(msg)
                                                }

                                                if(attacker.alive){
                                                    let critRoll = action.ability.critical
                                                    if(weaponPassives[4] > 0){
                                                        if(attacker.lastAction == actionCode){
                                                            critRoll += weaponPassives[4] * 10
                                                        }
                                                    }
                                                    let crit = Math.floor(Math.random() * 100) < critRoll ? 2 : 1
                                                    let totalDamage;
                                                    if(!target.hasActed && weaponPassives[1] > 0){
                                                        attackBase += weaponPassives[1] * 4
                                                    }

                                                    if(crit && weaponPassives[0] > 0){
                                                        totalDamage = calculateAttackDamage(
                                                            attacker.staticData.level,
                                                            attacker.liveData.stats[action.ability.damage_type] * statChangeStages[attacker.liveData.statChanges[action.ability.damage_type]],
                                                            ((100 - (weaponPassives[0] * 5))/100) * (target.liveData.stats[action.ability.damage_type == "atk" ? "def" : "spdef"] * statChangeStages[target.liveData.statChanges[action.ability.damage_type == "atk" ? "def" : "spdef"]]),
                                                            attackBase
                                                        )
                                                    } else {
                                                        totalDamage = calculateAttackDamage(
                                                            attacker.staticData.level,
                                                            attacker.liveData.stats[action.ability.damage_type] * statChangeStages[attacker.liveData.statChanges[action.ability.damage_type]],
                                                            target.liveData.stats[action.ability.damage_type == "atk" ? "def" : "spdef"] * statChangeStages[target.liveData.statChanges[action.ability.damage_type == "atk" ? "def" : "spdef"]],
                                                            attackBase
                                                        )
                                                    }

                                                    let effectiveness = 1; 
                                                    let sameType = parseInt(attacker.staticData.faction) == parseInt(action.ability.faction) ? 1.25 : 1
                        
                                                    if(action.ability.faction != -1){
                                                        effectiveness = factionMatchups[action.ability.faction][target.staticData.faction]
                                                        
                                                        switch(effectiveness){
                                                            case 1.5:
                                                                session.session_data.battlelog.combat.push("It had a powerful impact on " + target.staticData.name)
                                                                break;
                                                            
                                                            case 0.5:
                                                                session.session_data.battlelog.combat.push("It had a weak impact on " + target.staticData.name)
                                                                break;
                                                        }
                                                    }
                                                    
                                                    

                                                    let finalDamage = Math.ceil(totalDamage * crit)
                                                    if(weaponPassives[5] > 0){
                                                        let physCheck = target.liveData.stats.def > target.liveData.stats.spdef && action.ability.damage_type == "atk"
                                                        let specCheck = target.liveData.stats.spdef > target.liveData.stats.def && action.ability.damage_type == "spatk"
                                                        if(physCheck || specCheck){
                                                            finalDamage = Math.ceil(finalDamage * (1 + weaponPassives[5] *.05))
                                                        } 
                                                    }
                                                    if(finalDamage > 0){
                                                        if(crit == 2){
                                                            critCount++
                                                            attacker.records.criticalsLanded++
                                                            if(!multiHit){
                                                                session.session_data.battlelog.combat.push("A critical hit!")
                                                            }
                                                        }
                                                        if(multiHit){
                                                            multiDamage += finalDamage
                                                            if(attackNum <= 1){
                                                                session.session_data.battlelog.combat.push(target.staticData.name + " took " + multiDamage + " total damage! (" + hitCount + " hits / " + critCount + " crits)")
                                                            }
                                                        } else {
                                                            session.session_data.battlelog.combat.push(target.staticData.name + " took " + finalDamage + " damage!")
                                                        }
                                                        target.liveData.stats.hp -= finalDamage;
                                                        target.records.timesHit++;
                                                        attacker.records.attackDamageDone += finalDamage
                                                        target.records.enemyDamageTaken += finalDamage
                                                        triggerCombatEvent({
                                                            type:2,
                                                            data:target
                                                        },session)
                                                    }
                                                    if(target.liveData.stats.hp <= 0){
                                                        target.staticData.lives -= 1
                                                        if(target.staticData.lives <= 0){
                                                            attackNum = 0
                                                            target.liveData.stats.hp = 0
                                                            target.alive = false
                                                            attacker.records.unitsDefeated++
                                                            target.target = -1
                                                            target.choosenAbility = -2
                                                            session.session_data.battlelog.combat.push(target.staticData.name + " was defeated!")
                                                            target.staticData.lives = 3
                                                            if(target.staticData.cpu){
                                                                processMobRewards(target,session)
                                                            }
                                                            triggerCombatEvent({
                                                                type:1,
                                                                data:target
                                                            },session)
                                                            if(target.staticData.rareVar){
                                                                attacker.records.raresDefeated++
                                                            }
                                                        } else {
                                                            session.session_data.battlelog.combat.push(target.staticData.name + " lost a life! (" + target.staticData.lives + " remaining)")
                                                            target.liveData.stats.hp = target.staticData.stats.hp
                                                        }
                                                    }

                                                    if(action.ability.recoil != 0 && finalDamage > 0){
                                                        let recoilDamage = Math.ceil(action.ability.recoil/100 * finalDamage);
                                                        session.session_data.battlelog.combat.push(attacker.staticData.name + " suffered from " + recoilDamage + " recoil damage!")
                                                        attacker.liveData.stats.hp -= recoilDamage
                                                        attacker.recoilDamageTaken += recoilDamage
                                                        if(attacker.liveData.stats.hp <= 0){
                                                            attacker.staticData.lives -= 1
                                                            if(attacker.staticData.lives <= 0){
                                                                attacker.liveData.stats.hp = 0
                                                                attacker.alive = false
                                                                attacker.attacker = -1
                                                                attacker.choosenAbility = -2
                                                                session.session_data.battlelog.combat.push(attacker.staticData.name + " was defeated!")
                                                                attacker.staticData.lives = 1
                                                                if(attacker.staticData.cpu){
                                                                    processMobRewards(target,session)
                                                                }
                                                                triggerCombatEvent({
                                                                    type:1,
                                                                    data:attacker
                                                                },session)
                                                                if(attacker.staticData.rareVar){
                                                                    target.records.raresDefeated++
                                                                }
                                                            } else {
                                                                session.session_data.battlelog.combat.push(attacker.staticData.name + " lost a life! (" + attacker.staticData.lives + " remaining)")
                                                                attacker.liveData.stats.hp = attacker.staticData.stats.hp
                                                            }
                                                        }
                                                    }
                                                }
                                                attackNum -= 1
                                            } else {
                                                if(hitCount > 0){
                                                        session.session_data.battlelog.combat.push(target.staticData.name + " took " + multiDamage + " total damage! (" + hitCount + " hits / " + critCount + " crits)")
                                                } else {
                                                    if(repeatPenal > 0){
                                                        if((action.ability.accuracy - repeatPenal) <= 0){
                                                            session.session_data.battlelog.combat.push(attacker.staticData.name + " has become too predictable so " + target.staticData.name + " was able to avoid their attack!")
                                                        } else {
                                                            session.session_data.battlelog.combat.push(target.staticData.name + " was able to avoid the repeated attack!")
                                                        }
                                                    } else {
                                                        session.session_data.battlelog.combat.push(attacker.staticData.name + " was unable to land their attack!")
                                                    }
                                                }
                                                attackNum = 0
                                            }
                                            attacker.target = -1
                                            attacker.choosenAbility = -1
                                        }
                                    }
                                }
                                attacker.lastAction = actionCode
                                session.session_data.battlelog.combat.push("---")
                            }
                            break;
                        case "guard":
                                let defender = session.session_data.fighters[action.index]
                                if(defender.alive){
                                    actionCode = defender.index + "_" + action.ability.action_type
                                    let repeatPenal = 1;
                                    if(defender.lastAction == actionCode){
                                        defender.repeats++
                                        defender.records.timesAbilityRepeat++
                                        repeatPenal = Math.pow(2,defender.repeats)
                                        
                                    } else {
                                        defender.repeats = 0
                                    }
                                    
                                    let chance = Math.floor(Math.random() * 100)
                                    let successRoll = action.ability.success_level/repeatPenal
                                    if(gearPassives[2] > 0 && defender.lastAction == actionCode){
                                        successRoll += gearPassives[2] * 5
                                    }
                                    let successCheck = chance < successRoll
                                    if(successCheck){
                                        session.session_data.battlelog.combat.push(defender.staticData.name + " used " + action.ability.name + " to defend themselves!")
                                        defender.guardData = action.ability
                                    } else {
                                        if(repeatPenal > 1){
                                            session.session_data.battlelog.combat.push(defender.staticData.name + " failed to prepare another block!")
                                        } else {
                                            session.session_data.battlelog.combat.push(defender.staticData.name + " failed to prepare to block!")
                                        }
                                        defender.guardData = "fail"
                                    }
                                    defender.target = -1
                                    defender.choosenAbility = -1
                                    defender.lastAction = actionCode
                                    session.session_data.battlelog.combat.push("---")
                                }
                            break;
                        case "stats":
                            let user = session.session_data.fighters[action.index]
                            if(user.alive){
                                session.session_data.battlelog.combat.push(user.staticData.name + " used " + action.ability.name + "!")
                                user.records.statChanges++
                                for(effect of action.ability.effects){
                                    let targets = []
                                    switch(effect.target){
                                        case "0":
                                            targets = [action.index]
                                            break;

                                        case "1":
                                            for(f in session.session_data.fighters){
                                                if(session.session_data.fighters[f].team == user.team){
                                                    targets.push(f)
                                                }
                                            }
                                            break;

                                        case "2":
                                            targets = [user.target]
                                            break;

                                        case "3":
                                            for(f in session.session_data.fighters){
                                                if(session.session_data.fighters[f].index != user.index){
                                                    targets.push(f)
                                                }
                                            }
                                            break;

                                        case "4":
                                            for(f in session.session_data.fighters){
                                                if(session.session_data.fighters[f].team != user.team){
                                                    targets.push(f)
                                                }
                                            }
                                            break;
                                    }
                                    if(targets.length > 1){
                                        actionCode = user.index + "_" + action.ability.name + "_" + action.ability.targetType
                                    } else {
                                        actionCode = user.index + "_" + action.ability.name + "_" + action.ability.targetType + "_" + targets[0]
                                    }   
                                    for(t of targets){
                                        let target = session.session_data.fighters[t]
                                        if(effect.value > 0){
                                            if(user.team == target.team){
                                                user.records.timesStatsRaised++
                                            }
                                        } else {
                                            if(user.team != target.team){
                                                user.records.timesStatsLowered++
                                            }
                                        }
                                        target.liveData.statChanges[effect.stat] += effect.value
                                        let msg;
                                        if(target.liveData.statChanges[effect.stat] > 16){
                                            target.liveData.statChanges[effect.stat] = 16
                                            msg = target.staticData.name + "'s " + effect.stat + " multiplier can't go higher!"
                                        } else if(target.liveData.statChanges[effect.stat] < 0){
                                            target.liveData.statChanges[effect.stat] = 0
                                            msg = target.staticData.name + "'s " + effect.stat + " multiplier can't go lower!"
                                        } else {
                                            msg = target.staticData.name + "'s " + effect.stat + " multiplier " +  (effect.value > 0 ? "increased" : "decreased") + " by " + effect.value + " stage" + (effect.value > 1 ? "s" : "") + " (x" + statChangeStages[target.liveData.statChanges[effect.stat]] + ")."
                                        }
                                        session.session_data.battlelog.combat.push(msg)
                                    }
                                }
                                user.lastAction = actionCode
                                user.target = -1
                                user.choosenAbility = -1
                                session.session_data.battlelog.combat.push("---")
                            }
                            break;
                    }
                    session.session_data.fighters[action.index].hasActed = true
                }
            }
            for(f of fighters){
                if(f.liveData.healing > 0){
                    f.liveData.hp += Math.ceil(f.liveData.maxhp * (f.liveData.healing/100))
                    if(f.liveData.hp > f.liveData.maxhp){
                        f.liveData.hp = f.liveData.maxhp
                    }
                    session.session_data.battlelog.combat.push(f.staticData.name + " regenerated " + f.liveData.healing + "% of their maximum health!")
                }
            }
            triggerCombatEvent({
                type:0
            },session)
            triggerCombatEvent({
                type:3
            },session)
            session.session_data.turn++
            checkActiveCombatants(session)
            if(!session.session_data.completed){
                runEnemyCombatAI(fighters)
            }
            return session
        } else {
            return session;
        }
    },
    handlePlayerFlee(session){
        checkActiveCombatants(session)
    },
    populateQuestScript(session){
        return playerQuestScript(quests[session.session_data.quest_id],session)
    },
    populateQuestConsole(session){
        const questData = quests[session.session_data.quest_id]
        let title = "Quest #" + questData.id + ": " + questData.name
        const embed = new MessageEmbed()
        .setColor("#7289da")
        .setTitle(title)

        embed.addField(
            "Story",
            playerQuestScript(questData,session)
        )


        switch(questData.actionPlan[session.session_data.questStep].type){
            case "choice":
                let actionData = questData.actionPlan[session.session_data.questStep].data
                let selectionLabels = []

                for(option of actionData.options){
                    selectionLabels.push({
                        label: option.name,
                        description: option.description,
                        value: JSON.stringify({
                            choiceData:option.value,
                            choiceStep:option.lineValue
                        })
                    })
                }

                const row1 = new MessageActionRow()
                    .addComponents(
                        new MessageSelectMenu()
                            .setCustomId('questChoice_' + session.session_id)
                            .setPlaceholder(actionData.question)
                            .addOptions(selectionLabels),
                    );

                return {
                    content:" ",
                    embeds:[embed],
                    components:[row1]
                }

            case "end":
                return {
                    content:" ",
                    embeds:[embed],
                    components:[]
                }
        }

            
    },
    populateDungeonEvent(session,interaction,callback){
        const embed = new MessageEmbed()
        .setColor("#7289da")
        .setTitle(session.session_data.player.name + "'s Dungeon Adventure - " + session.session_data.town.name + " (Level " + session.session_data.dungeonRank + ")")


        if(session.session_data.eventResult.proll){
            let result = session.session_data.eventResult;
            let resultText = "Roll Requirement: " + result.eroll[0] + " (Max: " + result.eroll[1] + ")" +
            "\nPlayer Roll: " + result.proll[0] + " (Max: " + result.proll[1] + ")"
            if(result.proll[0] >= result.eroll[0]){
                resultText += "\n\n" + session.session_data.player.name + " is able to progress through the dungeon"
            } else {
                resultText += "\n\n" + session.session_data.player.name + " was not able to progress through the dungeon"
            }
            resultText += "\n(Danger level is now " + session.session_data.dangerValue + ")"
            embed.addField("Event Result",resultText)
        } else if (session.session_data.eventResult.skip){
            embed.addField("Event Result",session.session_data.eventResult.skip)
        }

        switch(session.session_data.event.type){
            case "choice":

                embed.addField(
                    session.session_data.event.title,
                    session.session_data.event.prompt
                )

                let selectionLabels = []

                for(option of session.session_data.event.options){
                    selectionLabels.push({
                        label: option.name,
                        description: option.description,
                        value: JSON.stringify(option.value)
                    })
                }
                
                selectionLabels.push({
                    label:"Leave Dungeon",
                    description: "End your dungeon adventure",
                    value: JSON.stringify({
                        type:"end"
                    })
                })

                if(!session.session_data.event.noSkip){
                    selectionLabels.push({
                        label:"Skip Encounter",
                        description: "Raise your danger level and skip this event",
                        value: JSON.stringify({
                            type:"skip"
                        })
                    })
                }

                const choices = new MessageActionRow()
                .addComponents(
                    new MessageSelectMenu()
                        .setCustomId('dungeonChoice_' + session.session_id)
                        .setPlaceholder("What will you do?")
                        .addOptions(selectionLabels),
                );

                interaction.update({
                    content:" ",
                    embeds:[embed],
                    components:[choices]
                })
                break;
                
                break;
            case "complete":

                let rewardsText = ""

                delete session.session_data.player.dungeon

                let rankKey =
                {
                    "C-":8,
                    "C":7,
                    "C+":6,
                    "B-":5,
                    "B":4,
                    "B+":4,
                    "A-":2,
                    "A":1,
                    "A+":0
                }
                let ranks = [
                    "A+",
                    "A",
                    "A-",
                    "B+",
                    "B",
                    "B-",
                    "C+",
                    "C",
                    "C-"
                ]
                
                let now = new Date();
                let speedRank,survivalRank,skillRank

                let totalTime = (now.getTime() - session.session_data.dungeonStart)/1000
                if(totalTime <= 90){
                    speedRank = ranks[0]
                } else {
                    let i = 1
                    while(totalTime > 90 + i * 30){
                        i++
                        if(i == 8){
                            break;
                        }
                    }
                    speedRank = ranks[i]
                }

                survivalRank = 3 * (session.session_data.rankStats.startLives - session.session_data.rankStats.currentLives)
                survivalRank += 3 - Math.floor(3 * (session.session_data.rankStats.currentHP/session.session_data.rankStats.startHP))
                survivalRank = ranks[survivalRank]
                
                if(session.session_data.rankStats.failedChecks == 0 && session.session_data.rankStats.skips == 0){
                    skillRank = ranks[0]
                } else {
                    if(session.session_data.rankStats.failedChecks + session.session_data.rankStats.skips * 3 <= 8){
                        skillRank = ranks[session.session_data.rankStats.failedChecks + session.session_data.rankStats.skips * 3]
                    } else {
                        skillRank = ranks[8]
                    }
                }

                if(!session.session_data.player.dungeonClears){
                    session.session_data.player.dungeonClears = {}
                } 
                if(!session.session_data.player.dungeonClears[session.session_data.dungeonRank]){
                    session.session_data.player.dungeonClears[session.session_data.dungeonRank] = [1,speedRank,survivalRank,skillRank]
                } else {
                    session.session_data.player.dungeonClears[session.session_data.dungeonRank][0]++

                    if(rankKey[speedRank] > rankKey[session.session_data.player.dungeonClears[session.session_data.dungeonRank][1]]){
                        session.session_data.player.dungeonClears[session.session_data.dungeonRank][1] = speedRank
                    }

                    if(rankKey[survivalRank] > rankKey[session.session_data.player.dungeonClears[session.session_data.dungeonRank][1]]){
                        session.session_data.player.dungeonClears[session.session_data.dungeonRank][2] = survivalRank
                    }

                    if(rankKey[skillRank] > rankKey[session.session_data.player.dungeonClears[session.session_data.dungeonRank][1]]){
                        session.session_data.player.dungeonClears[session.session_data.dungeonRank][3] = skillRank
                    }
                }

                let rankingText = ""
                rankingText += "Clear Time (" + speedRank + "):\n" + msToTime(totalTime * 1000)
                rankingText += "\n\nClear Survival (" + survivalRank + "):\nHealth: " + Math.floor((session.session_data.rankStats.currentHP/session.session_data.rankStats.startHP) * 100) + "%\nLives: " + session.session_data.rankStats.startLives + "/" + session.session_data.rankStats.currentLives
                rankingText += "\n\nClear Skill (" + skillRank + "):\nFails: " + session.session_data.rankStats.failedChecks + "\nSkips: " + session.session_data.rankStats.skips
                
                embed.addField(
                    "Dungeon Adventure Results!",
                    rankingText
                )

                    
                let newData = {
                    ref:{
                        type: "rngEquipment",
                        rngEquipment: {
                            scaling: false,
                            value:1.25,
                            conValue:0.25,
                            lockStatTypes: true,
                            baseVal: 30 * session.session_data.dungeonRank,
                            weaponType:session.session_data.player.combatStyle,
                            types: ["weapon","gear"]
                        }
                    }
                }

                let player = session.session_data.player

                let item = generateRNGEquipment(newData)
                player = givePlayerItem(item,player)
                rewardsText += player.name + " received equipment: " + item.name

                let result = parseReward({
                    type:"resource",
                    resource:"abilitypoints",
                    resourceName: "ability points",
                    amount: session.session_data.dungeonRank * 5
                }, player)
                player = result[0]

                if(result[1].length > 0){
                    for(msg of result[1]){
                        rewardsText += "\n" + msg
                    }
                }

                let expAmount = Math.floor((player.expCap *0.5) * ((32 - (rankKey[speedRank] + rankKey[skillRank] + rankKey[survivalRank]))/32))
                if(expAmount < 500){
                    expAmount = 500
                }

                result = parseReward({
                    type:"resource",
                    resource:"exp",
                    resourceName: "experience",
                    amount: expAmount,
                }, player)
                player = result[0]

                if(result[1].length > 0){
                    for(msg of result[1]){
                        rewardsText += "\n" + msg
                    }
                }

                let goldAmount = Math.ceil((10 * session.session_data.dungeonRank) * ((32 - (rankKey[speedRank] + rankKey[skillRank] + rankKey[survivalRank]))/32))
                result = parseReward({
                    type:"resource",
                    resource:"gold",
                    resourceName: "gold",
                    amount: goldAmount,
                }, player)
                player = result[0]

                if(result[1].length > 0){
                    for(msg of result[1]){
                        rewardsText += "\n" + msg
                    }
                }


                embed.addField(
                    "Dungeon Rewards!",
                    rewardsText
                )

                let updates = [
                    {
                        id:session.user_ids[0],
                        path:"",
                        value:session.session_data.player
                    }
                ]

                let townUpdates = []

                if(session.session_data.town.level == session.session_data.dungeonRank){
                    townUpdates.push({
                        id:session.session_data.town.id,
                        path:"dungeonClear",
                        value:true
                    })
                }

                interaction.update({
                    content:" ",
                    embeds:[embed],
                    components:[]
                })

                callback({
                    updatePlayer:updates,
                    updateTown:townUpdates,
                    removeSession:session
                })
                break;
        }
    },
    populateCombatToQuestTransition(session){
        const row1 = new MessageActionRow()
        .addComponents(
                new MessageButton()
                .setCustomId('continueQuest_' + session.session_id)
                .setLabel('Continue Quest')
                .setStyle('PRIMARY')
        )

        return [row1]
    },
    populateAbilityCreatorWindow(session){
        let valueTranslate = {
            "faction":{
                "-1":"None",
                "0":"Assailment",
                "1":"Attainment",
                "2":"Spontaneity",
                "3":"Sovereignty",
                "4":"Persecution",
                "5":"Aberration",
            },
            "success_level":{
                "25":"Very Low",
                "50":"Low",
                "100":"Normal",
                "200":"High",
                "400":"Very High"
            },
            "targetType":{
                "1":"One Target",
                "2":"All Enemies",
                "3":"Everyone Else"
            },
            "statchangetarget":{
                "0":"User",
                "1":"One Target",
                "2":"All Enemies",
                "3":"All",
                "4":"All Allies"
            }
        }

        let ability = session.session_data.ability
        let displayText = "```diff\n"
        displayText += "Ability points to spend: " + session.session_data.abilitypoints + "\n"
        displayText += "Current Ability point cost: " + calculateAbilityCost(
            session.session_data.ability,
            abilityWeights.weapon[session.session_data.weapon],
            abilityWeights.race[session.session_data.race]
        ) + "\n\n"
        
        displayText += "Character Weapon Type Modifiers:"
        for(mod in abilityWeights.weapon[session.session_data.weapon][session.session_data.ability.action_type]){
            displayText += "\n     " + mod + ": " + (abilityWeights.weapon[session.session_data.weapon][session.session_data.ability.action_type][mod] > 0 ? "+" : "") + abilityWeights.weapon[session.session_data.weapon][session.session_data.ability.action_type][mod] * 100 + "% cost"
        }

        displayText += "\n\nCharacter Race Modifiers:"
        for(mod in abilityWeights.race[session.session_data.race][session.session_data.ability.action_type]){
            displayText += "\n     " + mod + ": " + (abilityWeights.race[session.session_data.race][session.session_data.ability.action_type][mod] > 0 ? "+" : "") + abilityWeights.race[session.session_data.race][session.session_data.ability.action_type][mod] * 100 + "% cost"
        }

        displayText += "\n\n" + ability.name + ":\n\n"
        displayText += createAbilityDescription(ability)
        displayText += "\n\nCurrently Editing: " + session.session_data.editingAttribute

        let attributeVal;
        let subAttributes = ["statchangestat","statchangevalue","statchangetarget"]
        if(subAttributes.includes(session.session_data.editingAttribute.split("|")[0])){
            let subatt = session.session_data.editingAttribute.split("|")[0]
            let index = session.session_data.editingAttribute.split("|")[1]
            switch(subatt){
                case "statchangestat":
                    attributeVal = session.session_data.ability.effects[index].stat
                    break;

                case "statchangetarget":
                    attributeVal = session.session_data.ability.effects[index].target
                    break;

                case "statchangevalue":
                    attributeVal = session.session_data.ability.effects[index].value
                    break;
            }
            displayText += "\nCurrent Value: " + 
            (
                valueTranslate[session.session_data.editingAttribute.split("|")[0]] != undefined ? 
                valueTranslate[session.session_data.editingAttribute.split("|")[0]][attributeVal] 
                : 
                attributeVal
            )
        } else {
            attributeVal = session.session_data.ability[session.session_data.editingAttribute]
            displayText += "\nCurrent Value: " + 
            (
                valueTranslate[session.session_data.editingAttribute] != undefined ? 
                valueTranslate[session.session_data.editingAttribute][attributeVal] 
                : 
                attributeVal
            )
        }
        displayText += "\n```"
        return displayText  
    },
    populateAbilityCreatorButtons(session){
        let selectionLabels = []

        for(abilityStat in session.session_data.ability){
            let noShow = ["effects","name","faction"]
            let description = "test"
            switch(abilityStat){
                case "action_type":
                    if(!session.session_data.permissions.stats){
                        description = "This changes an ability either a guard or an attack"
                    } else {
                        description = "This changes an ability either a guard, stat changer, or an attack"
                    }
                    break;
            
                case "critical":
                    description = "This value affects the chance this ability has to land a critical hit"
                    break;
    
                case "damage_type":
                    description = "This changes the type of damage dealt by the ability"
                    break;
    
                case "damage_val":
                    description = "This value changes the amount of damage done by this ability"
                    break;
    
                case "speed":
                    description = "This changes the order in which this ability is executed during a turn"
                    break;
    
                case "faction":
                    description = "This changes the allignement of the attack, modifying what it's effective/less effective against"
                    break;
    
                case "accuracy":
                    description = "This value changes an attacks chance to hit. Once over 100, it improves repeated useability"
                    break;
    
                case "guard_val":
                    description = "This value changes the strength of protection provided by this ability"
                    break;
    
                case "success_level":
                    description = "This changes the rate of success this ability will have when used"
                    break;
    
                case "counter_val":
                    description = "This value changes the amount of damage done by the counter attack this ability triggers"
                    break;
    
                case "counter_type":
                    description = "This changes the type of damage the counter attack of this ability will do"
                    break;

                case "counter_type":
                    description = "This changes the type of damage this guard is most effective at blocking"
                    break;
    
                case "numHits":
                    description = "This value changes the number of times this ability will attack"
                    break;
    
                case "targetType":
                    description = "This changes the targets that this attack has"
                    break;
    
                case "recoil":
                    description = "This value changes the percentage of damage the user will take based on damage done"
                    break;

                case "statChangeCount":
                    description = "This value changes the number of stats that the ability changes"
                    break;
            }
            if(session.session_data.permissions.faction && abilityStat == "faction"){
                abilityStat = false
            }
            if((session.session_data.ability.action_type == "guard" && abilityStat == "speed")){
                abilityStat = false
            }
            if(noShow.includes(abilityStat)){
                abilityStat = false
            }
            
            if(abilityStat != false){
                selectionLabels.push({
                    label: abilityStat,
                    description: description,
                    value: abilityStat,
                })
            }
        }

        if(session.session_data.ability.action_type == "stats"){
            for(i in session.session_data.ability.effects){
                selectionLabels.push({
                    label: "Stat Change #" + (1+parseInt(i)) + "'s Stat",
                    description: "Stat changed by stat change #" + (1+parseInt(i)),
                    value: "statchangestat|" + i,
                })

                selectionLabels.push({
                    label: "Stat Change #" + (1+parseInt(i)) + "'s Value",
                    description: "Value of change caused by stat change #" + (1+parseInt(i)),
                    value: "statchangevalue|" + i,
                })

                selectionLabels.push({
                    label: "Stat Change #" + (1+parseInt(i)) + "'s Target",
                    description: "Target of stat change #" + (1+parseInt(i)),
                    value: "statchangetarget|" + i,
                })
            }
        }

        const row1 = new MessageActionRow()
            .addComponents(
                new MessageSelectMenu()
                    .setCustomId('selectAttribute_' + session.session_id)
                    .setPlaceholder('Select an Ability Attribute To Change')
                    .addOptions(selectionLabels),
            );
        
        const row2 = new MessageActionRow()
            .addComponents(
                new MessageButton()
                .setCustomId('addAbility_' + session.session_id)
                .setLabel('Add Ability')
                .setStyle('PRIMARY')
                .setDisabled(
                    calculateAbilityCost(
                    session.session_data.ability,
                    abilityWeights.weapon[session.session_data.weapon],
                    abilityWeights.race[session.session_data.race]
                    ) 
                    > session.session_data.abilitypoints
                ),
        
                new MessageButton()
                .setCustomId('cancel_' + session.session_id)
                .setLabel('Cancel')
                .setStyle('DANGER')
            )



        let valueTranslate = {
            "faction":{
                "-1":"None",
                "0":"Assailment",
                "1":"Attainment",
                "2":"Spontaneity",
                "3":"Sovereignty",
                "4":"Persecution",
                "5":"Aberration",
            },
            "success_level":{
                "25":"Very Low",
                "50":"Low",
                "100":"Normal",
                "200":"High",
                "400":"Very High"
            },
            "targetType":{
                "1":"One Target",
                "2":"All Enemies",
                "3":"Everyone Else"
            },
            "statchangetarget":{
                "0":"User",
                "1":"One Target",
                "2":"All Enemies",
                "3":"All",
                "4":"All Allies"
            }
        }
        

        let AttributeType = ""
        let AttributeValues = []
        switch(session.session_data.editingAttribute.split("|")[0]){
            case "action_type":
                AttributeType = "values";
                AttributeValues = ["attack","guard","stats"]
                break;
        
            case "critical":
                AttributeType = "upgrades"
                AttributeValues = [0,100,5]
                break;

            case "damage_type":
                AttributeType = "values"
                AttributeValues = ["atk","spatk"]
                break;

            case "damage_val":
                AttributeType = "upgrades"
                AttributeValues = [10,100,5]
                break;

            case "speed":
                AttributeType = "values"
                AttributeValues = [0,1,2,4]
                break;

            case "faction":
                AttributeType = "values"
                AttributeValues = ["-1","0","1","2","3","4","5"]
                break;

            case "accuracy":
                AttributeType = "upgrades"
                AttributeValues = [10,130,10]
                break;

            case "guard_val":
                AttributeType = "upgrades"
                AttributeValues = [10,100,5]
                break;

            case "success_level":
                AttributeType = "values"
                AttributeValues = ["25","50","100","200","400"]
                break;

            case "counter_val":
                AttributeType = "upgrades"
                AttributeValues = [0,100,5]
                break;

            case "counter_type":
                AttributeType = "values"
                AttributeValues = ["def","spdef"]
                break;

            case "guard_type":
                AttributeType = "values"
                AttributeValues = ["def","spdef"]
                break;

            case "numHits":
                AttributeType = "upgrades"
                AttributeValues = [1,5,1]
                break;

            case "targetType":
                AttributeType = "values"
                AttributeValues = ["1","2","3"]
                break;

            case "recoil":
                AttributeType = "upgrades"
                AttributeValues = [0,100,5]
                break;

            case "statChangeCount":
                AttributeType = "upgrades"
                AttributeValues = [1,3,1]
                break;

            case "statchangetarget":
                AttributeType = "values"
                AttributeValues = ["0","1","2","3","4"]
                break;

            case "statchangevalue":
                AttributeType = "upgrades"
                AttributeValues = [-75,300,5]
                break;

            case "statchangestat":
                AttributeType = "values"
                AttributeValues = ["atk","spatk","def","spdef","spd"]
                break;
                
        }
        const row3 = new MessageActionRow()

        let returnArray = []

        let subAttributes = ["statchangestat","statchangevalue","statchangetarget"]

        let attributeVal; 
        
        if(subAttributes.includes(session.session_data.editingAttribute.split("|")[0])){
            let subatt = session.session_data.editingAttribute.split("|")[0]
            let index = session.session_data.editingAttribute.split("|")[1]
            switch(subatt){
                case "statchangestat":
                    attributeVal = session.session_data.ability.effects[index].stat
                    break;

                case "statchangetarget":
                    attributeVal = session.session_data.ability.effects[index].target
                    break;

                case "statchangevalue":
                    attributeVal = session.session_data.ability.effects[index].value
                    break;
            }
        } else {
            attributeVal = session.session_data.ability[session.session_data.editingAttribute]
        }

        

        let AttributeLabels = []

        if(valueTranslate[session.session_data.editingAttribute.split("|")[0]]){
            for(i in AttributeValues){
                AttributeLabels[i] = valueTranslate[session.session_data.editingAttribute.split("|")[0]][AttributeValues[i]]
            }
        }

        switch(AttributeType){
            case "upgrades":
                row3.addComponents(
                    new MessageButton()
                    .setCustomId('changeAtt_' + session.session_id + "_decrease|" + AttributeValues[2])
                    .setLabel('<')
                    .setStyle('DANGER')
                    .setDisabled(!(attributeVal - AttributeValues[2] >= AttributeValues[0])),

                    new MessageButton()
                    .setCustomId('changeAtt_' + session.session_id + "_increase|" + AttributeValues[2])
                    .setLabel('>')
                    .setStyle('SUCCESS')
                    .setDisabled(!(attributeVal + AttributeValues[2] <= AttributeValues[1])),
                );
                returnArray = [row1,row3,row2]
                break;

            case "values":
                if(AttributeValues.length > 5){
                    const row4 = new MessageActionRow()
                    for(var i = 0; i < 4; i++){
                        let value = AttributeValues[i]
                        row3.addComponents(
                            new MessageButton()
                            .setCustomId('setAtt_' + session.session_id + '_' + value)
                            .setLabel("" + (AttributeLabels[i] != undefined ? AttributeLabels[i] : value))
                            .setStyle('PRIMARY')
                            .setDisabled(attributeVal == value)
                        )
                    }
                    for(var i = 4; i < AttributeValues.length; i++){
                        let value = AttributeValues[i]
                        row4.addComponents(
                            new MessageButton()
                            .setCustomId('setAtt_' + session.session_id + '_' + value)
                            .setLabel("" + (AttributeLabels[i] != undefined ? AttributeLabels[i] : value))
                            .setStyle('PRIMARY')
                            .setDisabled(attributeVal == value)
                        )
                    }
                    returnArray = [row1,row4,row3,row2]
                } else {
                    for(var i = 0; i < AttributeValues.length; i++){
                        let value = AttributeValues[i]
                        row3.addComponents(
                            new MessageButton()
                            .setCustomId('setAtt_' + session.session_id + '_' + value)
                            .setLabel("" + (AttributeLabels[i] != undefined ? AttributeLabels[i] : value))
                            .setStyle('PRIMARY')
                            .setDisabled(attributeVal == value)
                        )
                    }
                    returnArray =[row1,row3,row2]
                }          
                break;
        }
        return returnArray;
    },
    calculateAbilityCost(ability){
        return calculateAbilityCost(ability)
    },
    populateLobbyControls(session){
        const row1 = new MessageActionRow()
        .addComponents(
                new MessageButton()
                .setCustomId('joinLobby_' + session.session_id)
                .setLabel('Join Lobby')
                .setStyle('SUCCESS'),

                new MessageButton()
                .setCustomId('leaveLobby_' + session.session_id)
                .setLabel('Leave Lobby')
                .setStyle('DANGER'),

                new MessageButton()
                .setCustomId('editLobby_' + session.session_id)
                .setLabel('Edit Lobby')
                .setStyle('PRIMARY'),

                new MessageButton()
                .setCustomId('startLobby_' + session.session_id)
                .setLabel('Start')
                .setStyle('SUCCESS'),
        );
        return [row1]
    },
    populateLobbyWindow(session){
        let displayText = ""
        displayText += "```diff\n"
        displayText += "Lobby Mode: " + session.session_data.lobbyType 
        displayText += "\n\nPlayers:"
        for(player of session.session_data.players){
            displayText += "\n" + player.name
            if(player.id == session.session_data.owner){
                displayText += " 👑"
            }
        }
        displayText += "\n```"
        return displayText
    },
    populateLobbyEdit(session){
        let lobbySelectionLabels = [{
            label: "FFA",
            description: "Free For All Combat Between All Lobby Members",
            value: "0",
        }]

        const row1 = new MessageActionRow()
            .addComponents(
                new MessageSelectMenu()
                    .setCustomId('selectLobbyMode_' + session.session_id)
                    .setPlaceholder('Selected Lobby Mode: ' + session.session_data.lobbyType)
                    .addOptions(lobbySelectionLabels),
            );

        let playerSelectionLabels = []

        for(player of session.session_data.players){
            playerSelectionLabels.push({
                label: "Ban " + player.name,
                description: "Select this to ban " + player.name + " from this lobby",
                value: player.id,
            })
        }

        const row2 = new MessageActionRow()
            .addComponents(
                new MessageSelectMenu()
                    .setCustomId('playerLobbyBan_' + session.session_id)
                    .setPlaceholder('Ban Player From Lobby')
                    .addOptions(playerSelectionLabels),
            );
        
        return [row1,row2]
    },
    populateReturnFromCombat(session,getRankingStats){
        if(getRankingStats){
            let row1;
            if(session.session_data.fighters[0].alive){
                row1 = new MessageActionRow()
                .addComponents(
                    new MessageButton()
                    .setCustomId('exitCombat_' + session.session_data.options.returnSession + "_" + session.session_data.fighters[0].liveData.stats.hp + "|" + session.session_data.fighters[0].staticData.lives)
                    .setLabel('Exit Combat Session')
                    .setStyle('PRIMARY')
                )         
            } else {
                row1 = new MessageActionRow()
                .addComponents(
                    new MessageButton()
                    .setCustomId('exitCombat_' + session.session_data.options.returnSession + "_" + session.session_data.fighters[0].liveData.stats.hp + "|0")
                    .setLabel('Exit Combat Session')
                    .setStyle('PRIMARY')
                )
            }
            
            return [row1]
        } else {
            let row1 = new MessageActionRow()
            .addComponents(
                    new MessageButton()
                    .setCustomId('exitCombat_' + session.session_data.options.returnSession)
                    .setLabel('Exit Combat Session')
                    .setStyle('PRIMARY')
            )
            return [row1]
        }
        
    },
    populateTownVisitWindow(session){
        const embed = new MessageEmbed()
        embed.setColor("#7289da")
        embed.setTitle(session.session_data.town.name + "'s Town - Lvl " + session.session_data.town.level)
        
        let now = new Date();
        switch(session.session_data.location){
            
            case null:
                embed.addField("Choose a Destination","Where in the town would you like to visit?")
                break;

            case "records":
                let recordText = "Coming Soon..."
                embed.addField("Task Hall - Records:",recordText)
                break;

            case "tasks":
                let taskText = ""
                if(session.session_data.temp && session.session_data.temp.taskRollResults){
                    console.log(session.session_data.temp)
                    switch(session.session_data.temp.taskRollResults.roll){
                        case 1:
                        case 2:
                        case 3:
                            taskText += "You could have done better..."
                            break;
                        case 4:
                        case 5:
                        case 6:
                            taskText += "You did alright"
                            break;
                        case 7:
                        case 8:
                        case 9:
                            taskText += "You did pretty well!"
                            break;
                        case 10:
                            taskText += "Perfect! "
                            break;
                    }
                    taskText += " (Rolled a " + session.session_data.temp.taskRollResults.roll + " out of 10)\n"
                    for(msg of session.session_data.temp.taskRollResults.extra){
                        taskText += msg + "\n"
                    }
                    taskText += session.session_data.player.name + " earned " + session.session_data.temp.taskRollResults.rep + " town reputation!\n"
                    console.log(session.session_data.temp.taskRollResults.multi,session.session_data.temp.currentTask.multiThresh)
                    if(session.session_data.temp.taskRollResults.multi < session.session_data.temp.currentTask.multiThresh){
                        taskText += "\n" + session.session_data.temp.currentTask.suggestedSolutionPrompt + "\n\n"
                    }
                } 
                if(session.session_data.player.taskTimer && session.session_data.player.taskTimer > now){
                    taskText += "You will be able to work on a task in " + msToTime(session.session_data.player.taskTimer - now) + "\n"
                } else {
                    taskText += "Choose a task you would like to work on from the drop down\n"
                }
                taskText += "New tasks will be available in " + msToTime(session.session_data.town.taskRestock - now)
                embed.addField("Task Hall - Task Completion:",taskText)
                break;

            case "adventure":
                let adventureText = "From this facility you can enter your character in idle based expeditions or engagement based dungeon raids.\n\nExpeditions can serve as a great way to earn resources for a server town.\n\nDungeon raids are required in order for a town to increase it's level"
                embed.addField("Adventurer's Hall - Expeditions and Dungeons:",adventureText)
                break;

            case "hall":
                let hallMessage = "";
                if(session.session_data.town.hallOwner.id == "hallNPC"){
                    hallMessage += "```diff\nYou arrive at the town's battle hall where a large statue of a guardian stands in front of the entrance. As you approach, it's intimidating helemet veers it's gaze upon you and it's eyes come to life\n\n'If you wish to become the owner of this hall, you must first defeat me in combat' a voice echoes from the looming statue```"
                    embed.addField("Battle Hall - King of the Hill:",hallMessage)
                } else {
                    hallMessage += "```diff\nYou arrive at the town's battle hall where the entrance is unblocked. As you walk in to the empty arena you notice a figure in the center. They turn to face you, waiting for you to engage them in combat```"
                    hallMessage += "\n" + session.session_data.town.hallOwner.name.slice(9,session.session_data.town.hallOwner.name.length) + " has had ownership of this battle hall for " + msToTime(now.getTime() - session.session_data.town.hallStart)
                    embed.addField("Battle Hall - King of the Hill:",hallMessage)
                }
                break;

            case "training":
                if(session.session_data.temp && session.session_data.temp.viewingAbilities){
                    let trainingMessage = "```diff\nAn instructor comes over and begins to asses your gear\n\n'I should be able to teach you a new trick or two, interested?'```"
                    trainingMessage += "\nListing Resets In: " + msToTime(session.session_data.town.trainingRestock - now.getTime()) + "\n"                    
                    for(ability of session.session_data.town.availableAbilities){
                        trainingMessage += "\n**" + ability[0].name + "** (Costs " + ability[1] + " Gold)\n```" +  createAbilityDescription(ability[0]) + "```"
                    }
                    if(session.session_data.temp.resultMessage){
                        trainingMessage += "\n" + session.session_data.temp.resultMessage + "\n"
                    }
                    trainingMessage += "\nYour gold: " + session.session_data.player.gold
                    embed.addField("Training Hall - Tutorial and Upgrades:",trainingMessage)
                } else {
                    let trainingMessage = "```diff\nA cheerful person greets you as you walk into to the training hall\n\n'Welcome traveler! Here you can prepare for battle with combat lessons or learn new/upgraded abilities from a combat master! What would you like to do today?'```\nNote: For tutorial lessons, your abilities and stats will be temporarily modified"
                    embed.addField("Training Hall - Tutorial and Upgrades:",trainingMessage)
                }
                break;

            case "market":
                let shopListings = "Items For Sale (Listing Resets In: " + msToTime(session.session_data.town.marketRestock - now.getTime()) + "):\n"
                for(i in session.session_data.town.listings){
                    let item = session.session_data.town.listings[i]
                    if(session.session_data.temp){
                        if(session.session_data.temp.selectedItem == i){
                            shopListings += "\n\->" + item[0].name + " - Price: " + item[1] + " Gold"
                        } else {
                            shopListings += "\n" + item[0].name + " - Price: " + item[1] + " Gold"
                        }
                    } else {
                        shopListings += "\n" + item[0].name + " - Price: " + item[1] + " Gold"
                    }
                    
                }
                shopListings += "\nYour gold: " + session.session_data.player.gold
                if(session.session_data.temp){
                    if(session.session_data.temp.resultMessage){
                        shopListings += "\n\n" + session.session_data.temp.resultMessage + "\n"
                    }
                }
                embed.addField("Market - Equipment Shop:",shopListings)
                if(session.session_data.temp){
                    if(session.session_data.temp.selectedItem > -1){
                        let item = session.session_data.town.listings[session.session_data.temp.selectedItem]
                        let selectedListing = "(Price: " + item[1] + "):\n```diff\n" + printEquipmentDisplay(item[0]) + "```"
                        embed.addField("Selected Item:",selectedListing)
                        if(session.session_data.player.inventory){
                            let yourListing = null
                            if(item[0].type == "weapon" && session.session_data.player.weapon != undefined){
                                yourListing = "```diff\n" + printEquipmentDisplay(session.session_data.player.inventory[session.session_data.player.weapon]) + "```"
                            }
                            if(item[0].type == "gear" && session.session_data.player.weapon != undefined){
                                yourListing = "```diff\n" + printEquipmentDisplay(session.session_data.player.inventory[session.session_data.player.gear]) + "```"
                            }   
                            if(yourListing != null){
                                embed.addField("Your current " + item[0].type + ":",yourListing)
                            }
                        }   
                    }
                }
                
                break;

            case "tavern":
                let entries = [
                    "You step into the tavern and an aroma of good times and better tasting food fills the air. The tavern keep calls at you from behind a counter, so you pull up a chair.\n\n'What can I get for ya?'"
                ]
                let content = "```" + entries[Math.floor(Math.random() * entries.length)] + "```"
                let p = session.session_data.player
                
                if(p.boosters){
                    for(var i = 0; i < p.boosters.length; i++){
                        let boost = p.boosters[i]
                        if(boost.expire < now.getTime()){
                            p.boosters.splice(i,1)
                            i--;
                        }
                    }
                    if(p.boosters.length > 0){
                        content += "\nYour Current Boosters:\n"
                        for(boost of p.boosters){
                            switch(boost.type){
                                case "healing":
                                    content += "\n" + boost.type + ": " + boost.value + "% (" + msToTime(Math.abs(now.getTime() - boost.expire)) +  " remaining)"
                                    break;

                                default:
                                    content += "\n" + boost.type + ": +" + boost.value + " Stage" + (boost.value > 1 ? "s" : "") + " (" + msToTime(Math.abs(now.getTime() - boost.expire)) +  " remaining)"
                                    break
                            }
                            
                        }
                    } else {
                        content += "\nNo Active Boosters"
                    }
                } else {
                    content += "\nNo Active Boosters"
                }
                content += "\n\nYour gold: " + p.gold
                embed.addField("Tavern - Booster Shop:",content)
                break;
            
            case "jobs":
                let town = session.session_data.town
                let jobs = {
                    exp:"Adventurer - Passively generate exp and some resources for towns of the servers you talk in",
                    0:"Miner - Passively generate minerals for towns of the servers you talk in",
                    1:"Lumberjack - Passively generate wood for towns of the servers you talk in",
                    2:"Farmer - Passively generate food for towns of the servers you talk in"
                }
                let foodCheck = town.resources.food[0] >= town.resources.food[1]
                let woodCheck = town.resources.wood[0] >= town.resources.wood[1]   
                let mineralsCheck = town.resources.minerals[0] >= town.resources.minerals[1]
                let resourceCheck = foodCheck && woodCheck && mineralsCheck

                let nextBuild = "\n\n**Progress To Town Level Up (Level " + (town.level + 1) + ")**"
                nextBuild += "\nCurrent Level Dungeon Cleared (Level " + town.level + "): " + (town.dungeonCleared ? "✅ Complete" : "❌ Incomplete")
                nextBuild += "\nResources Maxed: " + (resourceCheck ? "✅ Complete" : "❌ Incomplete") 
                nextBuild += "\nPoint Threshold Reached (" + town.points + "/" + town.level * 10 + "): " + (town.points >= town.level * 10 ? "✅ Complete" : "❌ Incomplete") 

                embed.addField("Meeting Hall - Town Status:",
                    "🪵(Wood): " + town.resources.wood[0] + "/" + town.resources.wood[1] +
                    "\n🥩(Food): " + town.resources.food[0] + "/" + town.resources.food[1] +
                    "\n💎(Minerals): " + town.resources.minerals[0] + "/" + town.resources.minerals[1]+
                    "\n\nTown Points: " + town.points +
                    "\n\nTotal resources you have contributed towards next level: " +  (!town.contributors[session.session_data.player.id] ? 0 : town.contributors[session.session_data.player.id])  + 
                    "\n\nYour current job: " + jobs[session.session_data.player.job] + nextBuild 
                    
                )
                break;
            case "defense":
                let raidData = session.session_data.town.raid
                let missions = raidPresets.missions
                let rankIndexer = ["Simple","Normal","Challenging"]
                let pointIndexer = [1,2,3]
                let report = "Current Raid Leader: " + raidData.leader.name + "\n\n"
                if(raidData.bossDefeats){
                    report += "Raiders defeated - New raid in " + msToTime(session.session_data.town.lastRaid - now.getTime())
                } else {
                    report += "**Complete the Retaliation Mission in " + msToTime(session.session_data.town.lastRaid - now.getTime()) + " or this town will lose " + session.session_data.town.level * 7 + " town points!**"
                }
                report +="\nCurrent town points: " + session.session_data.town.points + "\n\n"
                let missionsComplete = true;
                for(var i = 0;i < 3; i++){
                    report += "**" + rankIndexer[i] + " Missions (" + pointIndexer[i] +" town points):**\n"
                    for(mission of raidData.missions[i]){
                        report += missions[i][mission.type]
                        if(mission.completers){
                            let count = 0
                            for(player in mission.completers){
                                count += mission.completers[player].times
                            }
                            if(count > 0){
                                report += " - ✅ Completed " + count + " times"
                            } else {
                                report += " - ❌ Incomplete"
                                missionsComplete = false
                            }
                            if(mission.completers[session.session_data.player.id]){
                                let progress = mission.completers[session.session_data.player.id]
                                report += "\nYou progression towards completion: " + progress.progression[0] + "/" + progress.progression[1] + "\n"
                            } else {
                                report += "\n"
                            }
                        } else {
                            report += " - ❌ Incomplete"
                            missionsComplete = false
                        }
                        report += "\n"
                    }
                    report += "\n"
                }
                if(missionsComplete){
                    report += "**Retaliation Mission Avaliable (5 town points) - Confront Raid Leader**"
                    if(raidData.bossDefeats){
                        let count = 0
                        for(player in raidData.bossDefeats){
                            count += raidData.bossDefeats[player].times
                        }
                        if(count > 0){
                            report += " - ✅ Completed " + count + " times"
                        } else {
                            report += " - ❌ Incomplete"
                        }   
                    } else {
                        report += " - ❌ Incomplete"
                    }
                } else {
                    report += "**Retaliation Mission Unavaliable (5 town points)** - *All other missions must be completed at least once to unlock*"
                }
                embed.addField("Militia Hall - Raid Defense Effort:",report)
                break;
        }
        return [embed]
    },
    populateTownVisitControls(session){
        let now = new Date()
        let selectionLabels = []

        for(location of innateFacilities){
            selectionLabels.push({
                label: location.name,
                description: location.description,
                value: location.value,
            })
        }

        
        for(location of acquiredFacilities){
            if(location.minLevel <= session.session_data.town.level){
                selectionLabels.push({
                    label: location.name,
                    description: location.description,
                    value: location.value,
                })
            }
        }
        

        selectionLabels.push({
            label: "End Session",
            description: "Finish your visit to this server's town",
            value: "end",
        })

        const travel = new MessageActionRow()
            .addComponents(
                new MessageSelectMenu()
                    .setCustomId('townVisit_' + session.session_id)
                    .setPlaceholder('Select a facility to visit')
                    .addOptions(selectionLabels),
                    
            );
        switch(session.session_data.location){
            case null:
                return [travel]

            case "records":
                return [travel]

            case "tasks":
                if(session.session_data.town.taskList && session.session_data.player.taskTimer < now){
                    let taskLabels = []
                    for(t in session.session_data.town.taskList){
                        let task = session.session_data.town.taskList[t]
                        taskLabels.push({
                            label: task.name,
                            description: task.description,
                            value: t,
                        })
                    }
                    let taskList = new MessageActionRow()
                    .addComponents(
                        new MessageSelectMenu()
                            .setCustomId('selectTask_' + session.session_id)
                            .setPlaceholder('Select a task to work on')
                            .addOptions(taskLabels),
                            
                    );
                    return [taskList,travel]
                } else {
                    return [travel]
                }
                break;

            case "adventure":
                let adventureChoice = new MessageActionRow()
                    .addComponents(
                        new MessageButton()
                        .setCustomId('promptDungeon_' + session.session_id)
                        .setLabel("Dungeon Adventure")
                        .setStyle('PRIMARY'),
                        new MessageButton()
                        .setCustomId('promptExpedition_' + session.session_id)
                        .setLabel("Expedition Adventure")
                        .setStyle('PRIMARY')
                    )
                return [adventureChoice,travel]
                break;

            case "hall":
                let hallChoice;
                if(session.session_data.town.hallOwner.id == "hallNPC"){
                    hallChoice = new MessageActionRow()
                    .addComponents(
                        new MessageButton()
                        .setCustomId('hallAttempt_' + session.session_id)
                        .setLabel("Fight to Claim the Battle Hall")
                        .setStyle('PRIMARY')
                    )
                    return [hallChoice,travel]
                } else {
                    hallChoice = new MessageActionRow()
                    .addComponents(
                        new MessageButton()
                        .setCustomId('hallAttempt_' + session.session_id)
                        .setLabel("Claim Battle Hall From " + session.session_data.town.hallOwner.name)
                        .setStyle('PRIMARY') 
                    )
                    return [hallChoice,travel]
                }
                break;

            case "training":
                if(session.session_data.temp && session.session_data.temp.viewingAbilities){
                    let abilityOptions = [{
                        label: "Return to training options",
                        description:"View training lessons",
                        value: "practiceLessons",
                    }]
                    for(a in session.session_data.town.availableAbilities){
                        let ability = session.session_data.town.availableAbilities[a]
                        abilityOptions.push({
                            label:ability[0].name,
                            description:"Learn " + ability[0].name + " (Cost " + ability[1] + " Gold)",
                            value:a
                        })
                    }
                    const trainingChoice = new MessageActionRow()
                    .addComponents(
                        new MessageSelectMenu()
                            .setCustomId('learnTrainingAbility_' + session.session_id)
                            .setPlaceholder('What would you like to do')
                            .addOptions(abilityOptions),                 
                    );
                    return [trainingChoice,travel]
                } else {
                    let trainingOptions = [
                        {
                            label: "Learn New Abilities",
                            description:"View catalogue of abilities that can be taught to your fighter",
                            value: "learnAbilities",
                        },{
                            label: "Lesson 1 - Dealing Damage",
                            description:"Learn to deal damage to opponents",
                            value: "lesson0",
                        },{
                            label: "Lesson 2 - Target Selection",
                            description:"Learn to target enemies with abilities",
                            value: "lesson1",
                        },{
                            label: "Lesson 3 - Damage Types",
                            description:"Learn to effectively use the different damage types",
                            value: "lesson2",
                        },{
                            label: "Lesson 4 - Blocking Damage",
                            description:"Learn to effectively use guards to reduce incoming damage",
                            value: "lesson3",
                        },{
                            label: "Lesson 5 - Counter Attacks",
                            description:"Learn to use guards offensively",
                            value: "lesson4",
                        },{
                            label: "Lesson 6 - Ability Repetition",
                            description:"Learn to consistently use your abilities successfully",
                            value: "lesson5",
                        },{
                            label: "Lesson 7 - Modifying Stats",
                            description:"Learn to modify stats to give yourself advantages",
                            value: "lesson6",
                        },{
                            label: "Lesson 8 - Ability Speed",
                            description:"Learn how the speed of your fighter and your abilities can impact combat",
                            value: "lesson7",
                        },{
                            label: "Lesson 9 - Managing Lives",
                            description:"Learn how to manage the lives of both your fighter and your opponents",
                            value: "lesson8",
                        }
                    ]
                
                    const trainingChoice= new MessageActionRow()
                    .addComponents(
                        new MessageSelectMenu()
                            .setCustomId('trainingOption_' + session.session_id)
                            .setPlaceholder('Choose something to do')
                            .addOptions(trainingOptions),                 
                    );
                    return [trainingChoice,travel]
                }
                break;

            case "market":

                let marketItems = []

                for(i in session.session_data.town.listings){
                    let item = session.session_data.town.listings[i]
                    marketItems.push({
                        label: item[0].name,
                        description: item[1] + " Gold",
                        value: i,
                    })
                }

                const marketListings = new MessageActionRow()
                .addComponents(
                    new MessageSelectMenu()
                        .setCustomId('selectListing_' + session.session_id)
                        .setPlaceholder('Choose an item to inspect')
                        .addOptions(marketItems),
                        
                );

                if(session.session_data.temp){
                    if(session.session_data.temp.selectedItem > -1){
                        const purchaseOptions = new MessageActionRow()
                        .addComponents(
                            new MessageButton()
                            .setCustomId('marketPurchase_' + session.session_id)
                            .setLabel("Purchase " + session.session_data.town.listings[session.session_data.temp.selectedItem][0].name + " For " + session.session_data.town.listings[session.session_data.temp.selectedItem][1] + " Gold")
                            .setStyle('SUCCESS')
                            .setDisabled(session.session_data.player.gold < session.session_data.town.listings[session.session_data.temp.selectedItem][1]),
                        )
                        return [purchaseOptions,marketListings,travel]
                    } else {
                        return [marketListings,travel]
                    }
                } else {
                    return [marketListings,travel]
                }
                break;

            case "jobs":
                let jobLabels = [
                    {
                        label: "Adventurer",
                        description: "Passively generate exp as you use discord",
                        value: "exp",
                    },
                    {
                        label: "Miner",
                        description: "Passively generate minerals for towns of the servers you talk in",
                        value: "0",
                    },
                    {
                        label: "Lumberjack",
                        description: "Passively generate wood for towns of the servers you talk in",
                        value: "1",
                    },
                    {
                        label: "Farmer",
                        description: "Passively generate food for towns of the servers you talk in",
                        value: "2",
                    }
                ]

        
                const jobChoice = new MessageActionRow()
                    .addComponents(
                        new MessageSelectMenu()
                            .setCustomId('setJob_' + session.session_id)
                            .setPlaceholder('Select a job for your character')
                            .addOptions(jobLabels),
                            
                    );
                return [jobChoice,travel]

            case "defense":
                let challengingMissions = ["Defend The Town Walls From Onslaught","Distract A Large Enemy","Siege An Enemy Camp"]
                let raidData = session.session_data.town.raid
                const missions = new MessageActionRow()
                .addComponents(
                    new MessageButton()
                    .setCustomId('raidMission_' + session.session_id + "_0")
                    .setLabel(challengingMissions[raidData.missions[2][0].type])
                    .setStyle('PRIMARY'),
                )
                let missionsComplete = true;
                for(var i = 0;i < 3; i++){
                    for(mission of raidData.missions[i]){
                        if(mission.completers){
                            let count = 0
                            for(player in mission.completers){
                                count += mission.completers[player].times
                            }
                            if(count <= 0){
                                missionsComplete = false
                            }
                        } else {
                            missionsComplete = false
                        }
                    }
                }
                if(missionsComplete){
                    missions.addComponents(
                        new MessageButton()
                        .setCustomId('raidMission_' + session.session_id + "_1")
                        .setLabel("Confront Raid Leader")
                        .setStyle('PRIMARY'),
                    )
                }
                return [missions,travel]

            case "tavern":
                let menu = [{
                    label: "Tavern Special",
                    description: "Random booster for 30 minutes - 20 gold",
                    value: "special_1_50_0.5",
                },{
                    label: "Assassin's Asparagus",
                    description: "1 Stage Speed booster for 1 hour - 50 gold",
                    value: "speed_1_50_1",
                },{
                    label: "Berserker's Beef",
                    description: "1 Stage Attack booster for 1 hour - 50 gold",
                    value: "attack_1_50_1",
                },{
                    label: "Caster's Cornbread",
                    description: "1 Stage Special Attack booster for 1 hour - 50 gold",
                    value: "spattack_1_50_1",
                },{
                    label: "Defender's Dumplings",
                    description: "1 Stage Defense booster for 1 hour - 50 gold",
                    value: "defense_1_50_1",
                },{
                    label: "Enforcer's Empanadas",
                    description: "1 Stage Special Defense booster for 1 hour - 50 gold",
                    value: "spdefense_1_50_1",
                },{
                    label: "Frontliner's Flapjacks",
                    description: "2.5% Health Regeneration for 1 hour - 50 gold",
                    value: "healing_2.5_50_1",
                }]

                let lifeDifference = 3 - session.session_data.player.lives
                for(var i = 3 - lifeDifference;i < 3; i++){
                    let pluralCheck = i > 1 ? "Slices" : "Slice"
                    menu.push({
                        label: i + " " + pluralCheck + " of cake",
                        description: "Increase Lives by " + i + " - " + (15 * i) + " gold",
                        value: "lives_" + i,
                    })
                }
                const orders = new MessageActionRow()
                .addComponents(
                    new MessageSelectMenu()
                    .setCustomId('tavernOrder_' + session.session_id)
                    .setPlaceholder('What would you like to order?')
                    .addOptions(menu),
                )
                return [orders,travel]
                break;

            default:
                return [travel]
        }
        
    },
    populateInventoryControls(session){
        let selectionLabels = []
        for(var i = 0 + (session.session_data.page - 1) * 5; i < (session.session_data.page) * 5; i++){
            if(session.session_data.inventory[i]){
                let item = session.session_data.inventory[i]
                selectionLabels.push({
                    label: "#" + (i+1) + ": " + item.name,
                    description: "",
                    value: "" + i,
                })
            }
        }

        const select = new MessageActionRow()
        .addComponents(
            new MessageSelectMenu()
                .setCustomId('selectInventory_' + session.session_id)
                .setPlaceholder('Select an item to view')
                .addOptions(selectionLabels),
                
        );

        const pages = new MessageActionRow()
        .addComponents(
            new MessageButton()
            .setCustomId('changeInvpage_' + session.session_id + "_0")
            .setLabel('Previous Page')
            .setStyle('PRIMARY')
            .setDisabled(session.session_data.page <= 1),

            new MessageButton()
            .setCustomId('changeInvpage_' + session.session_id + "_1")
            .setLabel('Next Page')
            .setStyle('PRIMARY')
            .setDisabled(session.session_data.page * 5 >= session.session_data.inventory.length),

            new MessageButton()
            .setCustomId('closeInventory_' + session.session_id)
            .setLabel('Leave Inventory')
            .setStyle('DANGER')
        )
        if(session.session_data.selected == null){
            return [select,pages]
        } else {
            const itemActions = new MessageActionRow()
            let item = session.session_data.inventory[session.session_data.selected]
            switch(item.type){
                case "weapon":
                    if(session.session_data.player[item.type] != session.session_data.selected){
                        itemActions.addComponents(
                            new MessageButton()
                            .setCustomId('toggleEquipSelected_' + session.session_id)
                            .setLabel('Equip Selected Weapon')
                            .setStyle('SUCCESS')
                        )
                    } else {
                        itemActions.addComponents(
                            new MessageButton()
                            .setCustomId('toggleEquipSelected_' + session.session_id)
                            .setLabel('Unequip Selected Weapon')
                            .setStyle('DANGER')
                        )
                    }
                    break;

                case "gear":
                    if(session.session_data.player[item.type] != session.session_data.selected){
                        itemActions.addComponents(
                            new MessageButton()
                            .setCustomId('toggleEquipSelected_' + session.session_id)
                            .setLabel('Equip Selected Gear')
                            .setStyle('SUCCESS')
                        )
                    } else {
                        itemActions.addComponents(
                            new MessageButton()
                            .setCustomId('toggleEquipSelected_' + session.session_id)
                            .setLabel('Unequip Selected Gear')
                            .setStyle('DANGER')
                        )
                    }
                    break;
            }
            itemActions.addComponents(
                new MessageButton()
                .setCustomId('deselect_' + session.session_id)
                .setLabel('Unselect Item')
                .setStyle('DANGER')
            )
            return [select,pages,itemActions]
        }
        
        
    },
    populateInventoryWindow(session){
        const embed = new MessageEmbed()
        embed.setColor("#7289da")
        embed.setTitle(session.session_data.player.name + "'s Inventory")
        let items = "```diff\n"
        for(var i = 0 + (session.session_data.page - 1) * 5; i < (session.session_data.page) * 5; i++){
            if(session.session_data.inventory[i]){
                let item = session.session_data.inventory[i];
                if(i == session.session_data.selected){
                    items += ">> "
                }
                items += "#" + (i+1) + ": " + item.name 
                switch(item.type){
                    case "gear":
                        items += "🛡️"
                        break;
                    
                    case "loot":
                        items += "💰"
                        break;

                    case "weapon":
                        items += "🗡️"
                        break;
                }
                if(i == session.session_data.selected){
                    items += " <<"
                }
                items += "\n"
            } else {
                items += "---\n"
            }
        }
        items += "```"
        embed.addField("Page: " + session.session_data.page + "/" + Math.ceil(session.session_data.inventory.length/5),items)
        
        
        if(session.session_data.selected == null){
            return [embed]
        } else {
            let item = session.session_data.inventory[session.session_data.selected];
            let data = "```diff\n"
            data += printEquipmentDisplay(item) + " "+"```"
            embed.addField("Selected Item",data,true)
            if(session.session_data.player[item.type] >= 0 && session.session_data.player[item.type] != null && session.session_data.player[item.type] != session.session_data.selected){
                data = "```diff\n"
                data += printEquipmentDisplay(session.session_data.inventory[session.session_data.player[item.type]]) + " "+"```"
                embed.addField("Equipped",data,true)
            }
            return [embed]
        }
    },
    populateTaskWindow(session){
        const embed = new MessageEmbed()
        embed.setColor("#7289da")
        embed.setTitle(session.session_data.temp.currentTask.name)
        embed.addField("Task Details",session.session_data.temp.currentTask.taskPrompt)
        return [embed]
    },
    populateTasksControls(session){
        let selectionLabels = []

        for(location of innateFacilities){
            selectionLabels.push({
                label: location.name,
                description: location.description,
                value: location.value,
            })
        }

        
        for(location of acquiredFacilities){
            if(location.minLevel <= session.session_data.town.level){
                selectionLabels.push({
                    label: location.name,
                    description: location.description,
                    value: location.value,
                })
            }
        }

        let solutionList = []
        for(s in session.session_data.temp.currentTask.solutionMap){
            let statSol = session.session_data.temp.currentTask.solutionMap[s]
            solutionList.push({
                label: statSol.solution,
                description: statSol.solutionDesc,
                value: s,
            })
        }

        let actions = new MessageActionRow()
        .addComponents(
            new MessageSelectMenu()
                .setCustomId('taskSolution_' + session.session_id)
                .setPlaceholder('Choose your solution to the task')
                .addOptions(solutionList),
        );

        const travel = new MessageActionRow()
        .addComponents(
            new MessageSelectMenu()
                .setCustomId('townVisit_' + session.session_id)
                .setPlaceholder('Select a facility to visit')
                .addOptions(selectionLabels),
                
        );

        return [actions,travel]
    },
    populateConformationWindow(session){
        const embed = new MessageEmbed()
        let message;
        switch(session.type){
            case "startExpedition":
                embed.setColor("#7289da")
                embed.setTitle(session.session_data.player.name + "'s Expedition - Town of " + session.session_data.town.name)
                message = "You are preparing to embark on an expedition from the town of " + session.session_data.town.name
                + "\n\n- You cannot use commands while on an expedition"
                + "\n- You will receive direct messages about the expedition"
                + "\n- Even when not active in Discord, events will still occur"
                + "\n- Nothing negative can happen to you while on an expedition"
                + "\n- To end an expedition, do any command in the server where you started it"
                + "\n\nAre you sure you would like to set out on an expedition?"
                embed.addField("Expedition Conformation",message)
                return [embed]
            
            case "startDungeon":
                embed.setColor("#7289da")
                embed.setTitle(session.session_data.player.name + "'s Dungeon Adventure - Town of " + session.session_data.town.name)
                message = "You are preparing to embark on a dungeon adventure in the town of " + session.session_data.town.name
                + "\n\n- Dungeons consist of multiple combat instances and stat check scenarios"
                + "\n- You will not auto heal between combat instances"
                + "\n- Fleeing from any combat instance will deplete your life count"
                + "\n- Running out of lives will end your dungeon adventure"
                + "\n- You may end your adventure during any stat check scenario"
                + "\n- Passive benefits from messaging are disabled while on a dungeon adventure"
                + "\n\nIf you would like to set out on a dungeon adventure, please select a dungeon level from the dropdown below"
                embed.addField("Dungeon Conformation",message)
                return [embed]
        }
    },
    populateConformationControls(session){
        let actions = new MessageActionRow()
        let actions2 = new MessageActionRow()
        switch(session.type){
            case "startExpedition":
                actions.addComponents(
                    new MessageButton()
                    .setCustomId('triggerExpedition_' + session.session_id + "_0")
                    .setLabel('Start Expedition')
                    .setStyle('SUCCESS')
                )
        
                actions.addComponents(
                    new MessageButton()
                    .setCustomId('triggerExpedition_' + session.session_id + "_1")
                    .setLabel('Cancel Expedition')
                    .setStyle('DANGER')
                )
                return [actions]
            
            case "endExpedition":
                actions.addComponents(
                    new MessageButton()
                    .setCustomId('endExpedition_X_0')
                    .setLabel('Continue Expedition')
                    .setStyle('SUCCESS')
                )
        
                actions.addComponents(
                    new MessageButton()
                    .setCustomId('endExpedition_X_1')
                    .setLabel('End Expedition')
                    .setStyle('DANGER')
                )
                return [actions]

            case "startDungeon":
                let dungeonLevels = []

                for(let i = 0; i < session.session_data.town.level; i++){
                    dungeonLevels.push({
                        label: "Dungeon Level " + (i + 1),
                        description: "Start a  Level " + (i + 1) + " Dungeon Run",
                        value: "" + (i + 1),
                    })
                }

                actions.addComponents(
                    new MessageSelectMenu()
                        .setCustomId('triggerDungeon_' + session.session_id + "_0")
                        .setPlaceholder('Select a dungeon level')
                        .addOptions(dungeonLevels),
                        
                );
        
                actions2.addComponents(
                    new MessageButton()
                    .setCustomId('triggerDungeon_' + session.session_id + "_1")
                    .setLabel('Cancel Dungeon Adventure')
                    .setStyle('DANGER')
                )
                return [actions, actions2]
            
        }
        
    }
}