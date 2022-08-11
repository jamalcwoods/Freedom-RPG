const { statChangeStages ,raidPresets, quests, statIncreaseRatios, factionMatchups, facilityData  } = require("./data.json");
const { MessageActionRow, MessageSelectMenu, MessageButton, MessageEmbed } = require('discord.js');
const {clone, createAbilityDescription, runEnemyCombatAI, printEquipmentDisplay, parseReward, weightedRandom, msToTime, prepCombatFighter, calculateAbilityCost } = require("./tools.js");
const fight = require("./commands/fight");
const { stat } = require("fs");
const { data } = require("./commands/fight");

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
                        let newUnit = weightedRandom(triggerData.data.units)
                        let fighterData = prepCombatFighter(newUnit.unit,session.session_data.fighters.length)
                        if(newUnit.alliance){
                            fighterData.team = newUnit.alliance
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
        if(fighter.alive && fighter.choosenAbility != -2 && fighter.staticData.abilities.length > 0){
            let choosenData = fighter.staticData.abilities[fighter.choosenAbility]
            let targets = []
            switch(choosenData.action_type){
                case "attack":
                    switch(choosenData.targetType){
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
        let displayText = "```diff\n"
        displayText += "Skillpoints to spend: " + session.session_data.skillpoints + "\n\n"
        for(stat in session.session_data.stats){
            if(session.session_data.stats[stat] < session.session_data.prevStats[stat]){
                displayText += "-"
            }else if(session.session_data.stats[stat] > session.session_data.prevStats[stat]){
                displayText += "+"
            } 
            displayText += stat + ": " + session.session_data.stats[stat] 
            let skillpointsNeeded;
            if(statIncreaseRatios[session.session_data.faction][stat] > 0){
                skillpointsNeeded = 1
            } else {
                skillpointsNeeded = 1/statIncreaseRatios[session.session_data.faction][stat]
            }
            if(stat == session.session_data.editingStat){
                displayText += " (-/+) " + statIncreaseRatios[session.session_data.faction][stat] + ": Refunds/Costs " + skillpointsNeeded 
                if(skillpointsNeeded > 1){
                    displayText += + " skillpoints"
                } else {
                    displayText += " skillpoint"
                }
                
            }
            displayText += "\n"
        }
        displayText += "\n```"
        return displayText
    },
    populateStatEditButtons(session){
        let selectionLabels = []

        for(stat in session.session_data.stats){
            selectionLabels.push({
                label: stat,
                description: "Select this to edit your character's " + stat + " stat",
                value: stat,
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
            let skillpointsNeeded;
            let stat = session.session_data.editingStat
            if(statIncreaseRatios[session.session_data.faction][stat] > 0){
                skillpointsNeeded = 1
            } else {
                skillpointsNeeded = 1/statIncreaseRatios[session.session_data.faction][stat]
            }
            if(session.session_data.skillpoints >= skillpointsNeeded){
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
                
                let defVal = fighter.liveData.stats.def * fighter.liveData.statChanges.def
                let spdefVal = fighter.liveData.stats.spdef * fighter.liveData.statChanges.spdef
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
                } else if (fighter.staticData.abilities.length < 1){
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
            let fighter = session.session_data.fighters[i]
            if(fighter.alive){
                if(fighter.choosenAbility == -1 && fighter.staticData.abilities.length > 0){
                    simTurn = false
                    break;
                }
            }
        }
        if(simTurn){
            let schedule = getAbilityOrder(fighters).reverse()
            for(timePeriod of schedule){
                for(action of timePeriod){
                    let actionCode;
                    switch(action.ability.action_type){
                        case "attack":
                            let attacker = session.session_data.fighters[action.index]
                            if(attacker.alive){

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

                                                if(target.guardData != "none"){
                                                    repeatPenal = 0
                                                }
                                            }

                                            let hitConfirm = accCheck < (action.ability.accuracy - repeatPenal)
                                            if(hitConfirm){
                                                switch(action.ability.damage_type){
                                                    case "atk":
                                                        attacker.records.attacks++
                                                        break;

                                                    case "spatk":
                                                        attacker.records.spattacks++
                                                        break;
                                                }
                                                
                                                if(target.guardData != "none"){
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
                                                        guardValue *= 0.5
                                                        attackBase -= guardValue
                                                        target.records.baseDamageBlocked += guardValue
                                                        if(attackBase <= 0){
                                                            attackBase = 0
                                                            attackNum = 0
                                                            session.session_data.battlelog.combat.push(target.staticData.name + " was able to block attack!")
                                                        } else {
                                                            session.session_data.battlelog.combat.push(target.staticData.name + " was able to block some of the damage!")
                                                        }
                                                    } else {
                                                        attackBase -= guardValue
                                                        target.records.baseDamageBlocked += guardValue
                                                        let notice;
                                                        if(attackBase <= 0){
                                                            attackBase = 0
                                                            attackNum = 0
                                                            notice = target.staticData.name + " blocked the attack"
                                                            target.records.timesBlocked++
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
                                                            
                                                            session.session_data.battlelog.combat.push(notice + " and followed up with a counter attack!")
            
                                                            attacker.records.timesHit++
                                                            attacker.liveData.stats.hp -= counterDamage;
                                                            target.records.counterDamageDone += counterDamage
                                                            session.session_data.battlelog.combat.push(attacker.staticData.name + " took " + counterDamage + " damage")
                                                            if(attacker.liveData.stats.hp <= 0){
                                                                attacker.staticData.lives -= 1
                                                                if(attacker.staticData.lives <= 0){
                                                                    attackNum = 0
                                                                    attacker.liveData.stats.hp = 0
                                                                    attacker.alive = false
                                                                    attacker.attacker = -1
                                                                    attacker.choosenAbility = -2
                                                                    session.session_data.battlelog.combat.push(attacker.staticData.name + " was defeated!")
                                                                    attacker.staticData.lives = 3
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
                                                            session.session_data.battlelog.combat.push(notice +"!")
                                                        }
                                                    }
                                                }

                                                if(attacker.alive){
                                                    let totalDamage = calculateAttackDamage(
                                                        attacker.staticData.level,
                                                        attacker.liveData.stats[action.ability.damage_type] * statChangeStages[attacker.liveData.statChanges[action.ability.damage_type]],
                                                        target.liveData.stats[action.ability.damage_type == "atk" ? "def" : "spdef"] * statChangeStages[target.liveData.statChanges[action.ability.damage_type == "atk" ? "def" : "spdef"]],
                                                        attackBase
                                                    )

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
                                                    
                                                    let crit = Math.floor(Math.random() * 100) < action.ability.critical ? 2 : 1
                                                    if(crit == 2){
                                                        session.session_data.battlelog.combat.push("A critical hit!")
                                                    }

                                                    let finalDamage = Math.ceil(totalDamage * effectiveness * sameType * crit)
                                                    if(finalDamage > 0){
                                                        session.session_data.battlelog.combat.push(target.staticData.name + " took " + finalDamage + " damage!")
                                                        target.liveData.stats.hp -= finalDamage;
                                                        target.records.timesHit++;
                                                        attacker.records.attackDamageDone += finalDamage
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
                                                                attacker.staticData.lives = 3
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
                                                if(repeatPenal > 0){
                                                    session.session_data.battlelog.combat.push(target.staticData.name + " was able to avoid the repeated attack!")
                                                } else {
                                                    session.session_data.battlelog.combat.push(attacker.staticData.name + " was unable to land their attack!")
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
                                        repeatPenal = Math.pow(2,defender.repeats)
                                    } else {
                                        defender.repeats = 0
                                    }
                                    
                                    let chance = Math.floor(Math.random() * 100)
                                    let successCheck = chance < (action.ability.success_level/repeatPenal)
                                    if(successCheck){
                                        session.session_data.battlelog.combat.push(defender.staticData.name + " used " + action.ability.name + " to defend themselves!")
                                        defender.guardData = action.ability
                                    } else {
                                        if(repeatPenal > 1){
                                            session.session_data.battlelog.combat.push(defender.staticData.name + " failed to prepare another block!")
                                        } else {
                                            session.session_data.battlelog.combat.push(defender.staticData.name + " failed to prepare to block!")
                                        }
                                    }
                                    defender.target = -1
                                    defender.choosenAbility = -1
                                    defender.lastAction = actionCode
                                    session.session_data.battlelog.combat.push("---")
                                }
                            break;
                        case "stats":
                            let user = session.session_data.fighters[action.index]
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
                                    target.liveData.statChanges[effect.stat] += effect.value
                                    let msg;
                                    if(target.liveData.statChanges[effect.stat] > 4){
                                        target.liveData.statChanges[effect.stat] = 4
                                        msg = target.staticData.name + "'s " + effect.stat + " multiplier can't go higher!"
                                    } else if(target.liveData.statChanges[effect.stat] < 0){
                                        target.liveData.statChanges[effect.stat] = 0
                                        msg = target.staticData.name + "'s " + effect.stat + " multiplier can't go lower!"
                                    } else {
                                        msg = target.staticData.name + "'s " + effect.stat + " multiplier " +  (effect.value > 0 ? "increased" : "decreased") + " by " + effect.value + " stage" + (effect.value > 1 ? "s" : "") + "(x " + statChangeStages[target.liveData.statChanges[effect.stat]] + ")."
                                    }
                                    session.session_data.battlelog.combat.push(msg)
                                }
                            }
                            session.session_data.battlelog.combat.push("---")
                            break;
                    }
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

            case "combat":
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
        displayText += "Skillpoints to spend: " + session.session_data.skillpoints + "\n"
        displayText += "Current Skillpoint cost: " + calculateAbilityCost(session.session_data.ability) + "\n\n"
        displayText += ability.name + ":\n\n"
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
            let noShow = ["effects","name"]
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
                    description = "This value changes the percentage of damage the user will take based on dmaage done"
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
                .setDisabled(calculateAbilityCost(session.session_data.ability) > session.session_data.skillpoints && false),
        
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
                if(!session.session_data.permissions.stats){
                    AttributeValues = ["attack","guard"]
                } else {    
                    AttributeValues = ["attack","guard","stats"]
                }
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
                AttributeValues = [1,6,1]
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
        },
        {
            label: "WILD",
            description: "Have The Lobby Members Fight Against Enemies Together",
            value: "1",
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
    populateReturnFromCombat(session){
        const row1 = new MessageActionRow()
        .addComponents(
                new MessageButton()
                .setCustomId('exitCombat_' + session.session_data.options.returnSession)
                .setLabel('Exit Combat Session')
                .setStyle('PRIMARY')
        )

        return [row1]
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
                    embed.addField("Training Hall - Tutorial and Challenges:",trainingMessage)
                } else {
                    let trainingMessage = "```diff\nA cheerful person greets you as you walk into to the training hall\n\n'Welcome traveler! Here you can prepare for battle with combat lessons or learn new/upgraded abilities from a combat master! What would you like to do today?'```\nNote: For tutorial lessons, your abilities and stats will be temporarily modified"
                    embed.addField("Training Hall - Tutorial and Challenges:",trainingMessage)
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
                if(session.session_data.temp){
                    if(session.session_data.temp.selectedItem > -1){
                        let item = session.session_data.town.listings[session.session_data.temp.selectedItem]
                        shopListings += "\n\nSelected Item (Price: " + item[1] + "):\n```diff\n" + printEquipmentDisplay(item[0]) + "```"
                        if(session.session_data.player.inventory){
                            if(item[0].type == "weapon" && session.session_data.player.weapon != undefined){
                                shopListings += "\n\nCurrent Weapon:\n```diff\n" + printEquipmentDisplay(session.session_data.player.inventory[session.session_data.player.weapon]) + "```"
                            }
                            if(item[0].type == "gear" && session.session_data.player.weapon != undefined){
                                shopListings += "\n\nCurrent Gear:\n```diff\n" + printEquipmentDisplay(session.session_data.player.inventory[session.session_data.player.gear]) + "```"
                            }   
                        }   
                        
                    }
                    if(session.session_data.temp.resultMessage){
                        shopListings += "\n\n" + session.session_data.temp.resultMessage + "\n"
                    }
                }
                shopListings += "\nYour gold: " + session.session_data.player.gold
                embed.addField("Market - Equipment Shop:",shopListings)
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
                                    content += "\n" + boost.type + " - " + boost.value + "% (" + msToTime(Math.abs(now.getTime() - boost.expire)) +  " remaining)"
                                    break;

                                default:
                                    content += "\n" + boost.type + " - " + boost.value + "x (" + msToTime(Math.abs(now.getTime() - boost.expire)) +  " remaining)"
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
                let jobs = [
                    "Adventurer - Passively generate exp and reputation for towns of the servers you talk in",
                    "Miner - Passively generate substantial exp and minerals for towns of the servers you talk in",
                    "Lumberjack - Passively generate substantial exp and wood for towns of the servers you talk in",
                    "Farmer - Passively generate substantial exp and food for towns of the servers you talk in"
                ]
                let nextBuild = ""
                if(session.session_data.town.facilities[session.session_data.town.facilityQueue]){
                    nextBuild = "\n\nNext Upgrade:\n Level up - " + facilityData[session.session_data.town.facilityQueue].name;
                } else {
                    nextBuild = "\n\nNext Facility To Build:\n" + facilityData[session.session_data.town.facilityQueue].name + ": " + facilityData[session.session_data.town.facilityQueue].description
                }
                embed.addField("Meeting Hall - Town Resources:",
                    "🪵(Wood): " + session.session_data.town.resources.wood[0] + "/" + session.session_data.town.resources.wood[1] +
                    "\n🥩(Food): " + session.session_data.town.resources.food[0] + "/" + session.session_data.town.resources.food[1] +
                    "\n💎(Minerals): " + session.session_data.town.resources.minerals[0] + "/" + session.session_data.town.resources.minerals[1]+
                    "\n\nYour current job: " + jobs[session.session_data.player.job] + nextBuild
                )
                break;
            case "defense":
                let raidData = session.session_data.town.raid
                let missions = raidPresets.missions
                let rankIndexer = ["Simple","Normal","Challenging"]
                let report = "Current Raid Leader: " + raidData.leader.name + "\n\n"
                let missionsComplete = true;
                for(var i = 0;i < 3; i++){
                    report += "**" + rankIndexer[i] + " Missions:**\n"
                    for(mission of raidData.missions[i]){
                        report += missions[i][mission.type]
                        if(mission.completers){
                            let count = 0
                            for(player in mission.completers){
                                count += mission.completers[player].times
                            }
                            if(count > 0){
                                report += " - ✅Completed " + count + " times"
                            } else {
                                report += " - ❌Incomplete"
                                missionsComplete = false
                            }
                            if(mission.completers[session.session_data.player.id]){
                                let progress = mission.completers[session.session_data.player.id]
                                report += "\nYou progression towards completion: " + progress.progression[0] + "/" + progress.progression[1] + "\n"
                            } else {
                                report += "\n"
                            }
                        } else {
                            report += " - ❌Incomplete"
                            missionsComplete = false
                        }
                        report += "\n"
                    }
                    report += "\n"
                }
                if(missionsComplete){
                    report += "**Retaliation Mission Avaliable - Confront Raid Leader**"
                    if(raidData.bossDefeats){
                        let count = 0
                        for(player in raidData.bossDefeats){
                            count += raidData.bossDefeats[player].times
                        }
                        if(count > 0){
                            report += " - ✅Completed " + count + " times"
                        } else {
                            report += " - ❌Incomplete"
                        }   
                    } else {
                        report += " - ❌Incomplete"
                    }
                } else {
                    report += "**Retaliation Mission Unavaliable** - *All other missions must be completed at least once to unlock*"
                }
                embed.addField("Militia Headquarters - Raid Defense Effort:",report)
                break;
        }
        return [embed]
    },
    populateTownVisitControls(session){

        let selectionLabels = []

        for(location of session.session_data.town.innateFacilities){
            selectionLabels.push({
                label: location.name,
                description: location.description,
                value: location.value,
            })
        }

        for(location of session.session_data.town.facilities){
            selectionLabels.push({
                label: location.name,
                description: location.description,
                value: location.value,
            })
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
                        label: "Adeventurer",
                        description: "Passively generate exp and reputation for towns of the servers you talk in",
                        value: "0",
                    },
                    {
                        label: "Miner",
                        description: "Passively generate substantial exp and minerals for towns of the servers you talk in",
                        value: "1",
                    },
                    {
                        label: "Lumberjack",
                        description: "Passively generate substantial exp and wood for towns of the servers you talk in",
                        value: "2",
                    },
                    {
                        label: "Farmer",
                        description: "Passively generate substantial exp and food for towns of the servers you talk in",
                        value: "3",
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
    }
}