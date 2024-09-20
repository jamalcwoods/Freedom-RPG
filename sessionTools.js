const { stanceBuffs, statChangeStages ,raidPresets, quests, statIncreaseRatios, innateFacilities, acquiredFacilities, abilityWeights, passiveDescriptions, tavernOptions, stanceDict ,standardDroptables, regionsEmojis, challengeDict, stanceMatchups } = require("./data.json");
const { MessageActionRow, MessageSelectMenu, MessageButton, MessageEmbed } = require('discord.js');
const { getTownDBData } = require("./firebaseTools.js")
const { capitalize ,clone, createAbilityDescription, runEnemyCombatAI, printEquipmentDisplay, parseReward, weightedRandom, msToTime, prepCombatFighter, calculateAbilityCost, simulateCPUAbilityAssign, simulateCPUSPAssign, generateRNGEquipment, givePlayerItem} = require("./tools.js");
const fs = require('fs');

function getFighterStat(fighter,stat){
       let rawValue = fighter.liveData.stats[stat] * statChangeStages[fighter.liveData.statChanges[stat]]
       switch(stat){
            case "atk":
                if(fighter.staticData.stance == "atk" && fighter.staticData.stances.atk.upgrades[1] > 0){
                    let buffData = getStanceBuffValues("atk",fighter.staticData.stances,1)
                    if(fighter.rageStacks){
                        rawValue = Math.ceil(rawValue *  (1 + ((buffData.val * fighter.rageStacks)/100)))
                    }
                }
                break;
            
            case "spatk":
                if(fighter.staticData.stance == "spatk" && fighter.staticData.stances.spatk.upgrades[1] > 0){
                    let buffData = getStanceBuffValues("spatk",fighter.staticData.stances,1)
                    if(fighter.nonDamaging){
                        rawValue = Math.ceil(rawValue *  (1 + ((buffData.val * fighter.nonDamaging)/100)))
                    }
                }
                break;
       }
       return rawValue
}

function getStanceBuffValues(stat,stanceData,index){
    return {
        val:stanceData[stat].upgrades[index] * stanceBuffs[stat][index].val,
        baseval:stanceBuffs[stat][index].baseval
    }
}

function processStanceGrowth(unit,stat,value){
    let messages = []

    if(unit.stances && unit.cpu == undefined){
        unit.stances[stat].points += value

        if(unit.stances[stat].points > 100){
            if(unit.stances[stat].active){
                unit.stances[stat].points -= 100
                if(unit.stances[stat].upgrades[0] + unit.stances[stat].upgrades[1]+ unit.stances[stat].upgrades[2] < 15){
                    let index = Math.floor(Math.random() * 3)
                    while(unit.stances[stat].upgrades[index] == 5){
                        index = Math.floor(Math.random() * 3)
                    }
                    unit.stances[stat].upgrades[index]++
                    messages.push(unit.name + "'s " + stanceBuffs[stat][index].name + " has been increased to rank " + unit.stances[stat].upgrades[index] + "!")
                } else {
                    let now = new Date()
                    unit.stances[stat].surgeTimer = now.getTime() + 900000
                    messages.push(unit.name + "'s " + stanceDict[stat] + " stance will be improved for the next 15 minutes!")
                }
            } else {
                unit.stances[stat].active = true
                messages.push(unit.name + " has unlocked the " + stanceDict[stat] + " stance!")
            }
        }
    }
    return messages
}

function damageFighter(session,damage,fighter,announce = false,returnDamage = false){
    fighter.records.timesHit++
    let messages = []
    messages = messages.concat(processStanceGrowth(fighter.staticData,"hp",1))
    if(messages.length > 0){
        for(m of messages){
            session.session_data.battlelog.alerts.push(m)
        }
    }
    if(fighter.shieldVal > 0){
        fighter.shieldVal -= damage
        damage -= fighter.shieldVal
        if(damage < 0){
            fighter.shieldVal = Math.abs(damage)
            damage = 0
        } else {
            fighter.shieldVal = 0
        }
    }
    fighter.liveData.stats.hp -= damage
    if(fighter.staticData.stance == "atk" && fighter.staticData.stances.atk.upgrades[1] > 0){
        if(!fighter.rageStacks){
            fighter.rageStacks = 0
        }
        fighter.rageStacks++
    }
    if(announce){
        session.session_data.battlelog.combat.push(fighter.staticData.name + " took " + damage + " damage!")
    }

    if(returnDamage){
        return damage
    }
}

function populateCombatWindow(session){     
    let fightData = session.session_data
    let title = ""
    if(session.session_data.options.quest){
        title = session.session_data.options.quest.title
    } else {
        if(session.session_data.turn == 0){
            title += "Waiting to begin"
        } else {
            if(session.session_data.completed){
                title += "Turn #" + session.session_data.turn  + " - Battle Completed"
            } else {
                title += "Turn #" + session.session_data.turn 
            }
            
        }

        if(fightData.fighters.length < 3){
            title += ": " + printFighter(fightData.fighters[0]) + " vs " + printFighter(fightData.fighters[1],false)
        } else {
            title += ": Mult-Duel (" + fightData.fighters.length + " combatants)"
        }
    }
    const embed = new MessageEmbed()
        .setColor("#7289da")
        .setTitle(title)
        .setFooter({ text: 'Session #' + session.session_id});

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
            } else if(spdefVal > + defVal * 1.25){
                character = "🟪"
            } else {
                character = "🟩"
            }

            let nodeI = 1
            for(let i = 1; i <= hpRatio;i++){
                if(fighter.staticData.weakPoint == fighter.staticData.lootPoint && fighter.staticData.lootPoint == nodeI){
                    if(nodeI == hpRatio){
                        emojiHealthbar += "❎"
                    } else {
                        emojiHealthbar += "🟧"
                    }
                } else  if(fighter.staticData.weakPoint == nodeI){
                    if(nodeI == hpRatio){
                        emojiHealthbar += "❎"
                    } else {
                        emojiHealthbar += "🟥"
                    }
                } else if(fighter.staticData.lootPoint == nodeI){
                    if(nodeI == hpRatio){
                        emojiHealthbar += "❎"
                    } else {
                        emojiHealthbar += "🟨"
                    }
                } else {
                    emojiHealthbar += character
                }
                nodeI++
            }
            for(let i = 1; i <= 8 - hpRatio;i++){
                if(fighter.staticData.weakPoint == nodeI || fighter.staticData.lootPoint == nodeI){
                    if((fighter.staticData.weakPoint == nodeI && fighter.weakPointHit) || (fighter.staticData.lootPoint == nodeI && fighter.lootPointHit)){
                        emojiHealthbar += "❌"    
                    } else {
                        emojiHealthbar += "🔳"
                    }
                } else {
                    emojiHealthbar += "🔲"
                }
                nodeI++
            }
            let hearts = ""
            if(fighter.alive){
                for(var i = 0; i < fighter.staticData.lives;i++){
                    hearts += "❤️"
                }
            }
            let fighterDesc = stanceDict[fighter.staticData.stance] + " Stance\n" + fighter.liveData.stats.hp + "/" + fighter.liveData.maxhp + " | " + hearts + "\n" + emojiHealthbar
            
            if(fighter.meter != undefined){
                fighterDesc += "\n"
                let meterRatio = Math.floor((fighter.meter/30)*8)
                for(let i = 1; i <= meterRatio;i++){
                    fighterDesc += "🟦"
                    nodeI++
                }
                for(let i = 1; i <= 8 - meterRatio;i++){
                    if(fighter.staticData.meterRank < 3){
                        fighterDesc += "🔲"
                    } else {
                        fighterDesc += "🟦"
                    }
                    
                    nodeI++
                }
            }
            
            if(fighter.staticData.meterRank > 0){
                if(fighter.staticData.meterRank < 3){
                    fighterDesc += "\n**x" + fighter.staticData.meterRank + "**"
                } else {
                    fighterDesc += "\n**MAX**"
                }
            }

            if(!fighter.alive){
                fighterDesc += "\n💀 **DEAD** 💀"
            } else if(session.session_data.winners.includes(fighter.staticData.id)){
                fighterDesc += "\n**Winner**"
            } else if(fighter.choosenAbility > -1 || fighter.stanceSwitch != undefined){
                if(fighter.staticData.cpu){
                    let tele = 0.90
                    if(fighter.staticData.tele){
                        tele = fighter.staticData.tele
                    }
                    let telegraphed = Math.random() < tele
                    if(telegraphed){
                        if(fighter.stanceSwitch){
                            fighterDesc += "\n**Preparing to switch stance...**"
                        } else {
                            switch(fighter.staticData.abilities[fighter.choosenAbility].action_type){
                                case "attack":
                                    switch(fighter.staticData.abilities[fighter.choosenAbility].damage_type){
                                        case "atk":
                                            fighterDesc += "\n**Preparing physical attack...**"
                                            break;

                                        case "spatk":
                                            fighterDesc += "\n**Preparing special attack...**"
                                            break;
                                    }
                                    
                                    break;
                                
                                case "guard":
                                    fighterDesc += "\n**Preparing to guard...**"
                                    break;

                                case "stats":
                                    fighterDesc += "\n**Preparing to modify stats...**"
                                    break;
                            }
                        }
                    } else {
                        fighterDesc += "\n**???**"
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
                embed.addField(teamDict[fighter.team] + printFighter(fighter) + "\nLvl - " + fighter.staticData.level, fighterDesc, true)
            } else {
                embed.addField(fighter.staticData.name + "\nLvl - " + fighter.staticData.level, fighterDesc, true)
            }
        }
    }
    let logTypes = ["dialogue","combat","alerts","rewards",]
    let typesC = {
        "dialogue":"Dialogue",
        "combat":"Combat",
        "rewards":"Rewards",
        "alerts":"Alerts"
    }
    for(type of logTypes){
        if(session.session_data.battlelog[type].length > 0){
            let lognum = 1
            let log = ""
            for(i in session.session_data.battlelog[type]){
                let action = session.session_data.battlelog[type][i]
                if(i == session.session_data.battlelog[type].length - 1 && action == "---"){
                    session.session_data.battlelog[type].splice(i,1)
                    break;
                }
                if((log + action).length > 1024){
                    embed.addField(
                        typesC[type] + " Log #" + lognum,
                        "\n" + log//"```diff\n" + log + "```"
                    )
                    lognum++;
                    log = ""
                }
                log += action + "\n"
                console.log(type + ": " + log.length)
            }
            if(lognum == 1){
                embed.addField(
                    typesC[type] + " Log",
                    "\n" + log//"```diff\n" + log + "```"
                )
            } else {
                embed.addField(
                    typesC[type] + " Log #" + lognum,
                    "\n" + log//"```diff\n" + log + "```"
                )
            }
        } else {
            if(type == "combat"){
                embed.addField(
                    typesC[type],
                    "\nWaiting for actions to be declared..."//"```diff\nWaiting for actions to be declared...```"
                )
            }
        }
    }
    if(session.session_data.turn == 0){
        session.session_data.logHistory = []
        if(session.session_data.battlelog.dialogue != []){
            session.session_data.logHistory[0] = {}
            session.session_data.logHistory[0].dialogue = clone(session.session_data.battlelog.dialogue)
            session.session_data.battlelog.dialogue = []
        }
    } else {
        if(!session.session_data.logHistory[session.session_data.turn - 1]){
            session.session_data.logHistory[session.session_data.turn - 1] = {}
        }
        for(type of logTypes){
            if(session.session_data.battlelog[type].length > 0){
                session.session_data.logHistory[session.session_data.turn - 1][type] = clone(session.session_data.battlelog[type])
            }
            session.session_data.battlelog[type] = []
        }
        fs.writeFile("logs/" + session.session_id + ".json", JSON.stringify(readableLog(session.session_data.logHistory), null, 4),function(){})
    }
    return [embed];

}

function populateCombatToQuestTransition(session){
    const row1 = new MessageActionRow()
    .addComponents(
            new MessageButton()
            .setCustomId('continueQuest_' + session.session_id)
            .setLabel('Continue Quest')
            .setStyle('PRIMARY')
    )

    return [row1]
}

function populateReturnFromCombat(session,getRankingStats){        
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
        if(session.session_data.turn > 0){
            row1.addComponents(
                new MessageButton()
                .setCustomId('sendLogs_' + session.session_id)
                .setLabel('History')
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
}

function populateCombatControls(session){   
    if(session.session_data.completed){
        const row1 = new MessageActionRow()
        if(session.session_data.turn > 0){
            row1.addComponents(
                new MessageButton()
                .setCustomId('sendLogs_' + session.session_id)
                .setLabel('History')
                .setStyle('PRIMARY')
            )
        }

        if(session.session_data.options.settlementBattle == undefined && session.session_data.options.freeExplore && session.session_data.fighters[0].alive){
            row1.addComponents(
                new MessageButton()
                .setCustomId('continueExploration_NULL')
                .setLabel('Continue Exploring')
                .setStyle('SUCCESS')
            )
        }
        return [row1]
    }

    let showName = session.user_ids.length = 1 || session.session_data.options.showAbilityNames
    const row1 = new MessageActionRow()
    for(var i = 0; i < 3; i++){
        if(session.session_data.fighters[0].staticData.abilities[i]){
            row1.addComponents(
                new MessageButton()
                .setCustomId('ability_' + session.session_id + '_' + i)
                .setLabel(showName == true ? cropString(session.session_data.fighters[0].staticData.abilities[i].name,14) :'Ability ' + (parseInt(i) + 1))
                .setStyle('SUCCESS'),
            )
        }
        
    }
    
    const row2 = new MessageActionRow()
    for(var i = 3; i < 6; i++){
        if(session.session_data.fighters[0].staticData.abilities[i]){
            row2.addComponents(
                new MessageButton()
                .setCustomId('ability_' + session.session_id + '_' + i)
                .setLabel(showName == true ? cropString(session.session_data.fighters[0].staticData.abilities[i].name,14) :'Ability ' + (parseInt(i) + 1))
                .setStyle('SUCCESS'),
            )
        }
        
    }

    let nonAbilityOptions = []
    if(session.session_data.options.canFlee){
        nonAbilityOptions.push({
            label: "Flee from combat",
            description: "Attempt to flee from combat",
            value: "flee",
        })
    }

    nonAbilityOptions.push({
        label: "View Fighter",
        description: "View your fighter's stats",
        value: "fighter",
    })

    nonAbilityOptions.push({
        label: "Empower",
        description: "Empower your next ability based on your combo meter",
        value: "empower",
    })

    nonAbilityOptions.push({
        label: "Change Stance",
        description: "Apply a buff while modifying your weaknesses and resistances",
        value: "stance",
    })

    nonAbilityOptions.push({
        label: "View Logs",
        description: "View combat logs",
        value: "logs",
    })

    const row4 = new MessageActionRow()

    if(row2.components.length == 0){
        row2.addComponents(
            new MessageSelectMenu()
                .setCustomId('nonAbilityAction_' + session.session_id)
                .setPlaceholder('Non-ability Actions')
                .addOptions(nonAbilityOptions),
        )
    } else {
        row4.addComponents(
            new MessageSelectMenu()
                .setCustomId('nonAbilityAction_' + session.session_id)
                .setPlaceholder('Non-ability Actions')
                .addOptions(nonAbilityOptions),
        )
    }
    
    if(session.session_data.livingFighters > 2){
        let selectionLabels = []
        for(fighter of session.session_data.fighters){
            if(fighter.alive){
                if(session.user_ids.length == 1 && fighter.staticData.id != session.user_ids[0]){
                    selectionLabels.push({
                        label: "Target " + fighter.staticData.name,
                        description: "Set " + fighter.staticData.name + " As Your Target",
                        value: "" + fighter.index,
                    })
                }
            }
        }

        const row3 = new MessageActionRow()
        .addComponents(
            new MessageSelectMenu()
                .setCustomId('selectTarget_' + session.session_id)
                .setPlaceholder('Select a Target')
                .addOptions(selectionLabels),
        )

        if(row4.components.length == 0){
            return [row3,row1,row2]
        } else {
            return [row3,row1,row2,row4]
        }
    } else {
        if(row4.components.length == 0){
            return [row1,row2]
        } else {
            return [row1,row2,row4]
        }
    }
}

function respondTOEndOfTurn(responseObj,callbackObj,interaction,callback,message){
    if(message){
        message.edit(responseObj)
    } else {
        interaction.update(responseObj)
    }

    callback(callbackObj)
}

function processEndOfTurn(error,session,interaction,callback,message){
    let responded = false
    let responseObj;
    let callbackObj;
    
    if(session.session_data.completed){
        if(session.session_data.options.progressiveCombat != false){
            if(session.session_data.options.quest){
                responseObj = {
                    embeds:populateCombatWindow(session),
                    components:populateCombatToQuestTransition(session)
                }
                callbackObj = {
                    updateSession:session
                }
                respondTOEndOfTurn(responseObj,callbackObj,interaction,callback,message)
            } else if(session.session_data.options.lobby){
                switch(session.type){
                    case "combat":
                            switch(session.session_data.options.fightType){
                                case "pvp":
                                    let updates = []
                                    
                                    for(var i = 0; i < session.session_data.fighters.length; i++){
                                        let fighter = session.session_data.fighters[i]
                                        if(!fighter.staticData.achievements){
                                            fighter.staticData.achievements = {
                                                kills:0,
                                                abilitiesUsed:0,
                                                livesLost:0,
                                                strongestAttack:0,
                                                tasksCompleted:0,
                                                dungeonsCleared:0,
                                                raidLeaderKills:0,
                                                playerBattlesWon:0
                                            }
                                        } 

                                        if(session.session_data.winners.includes(fighter.staticData.id)){
                                            fighter.staticData.achievements.playerBattlesWon++
                                            updates.push({
                                                id:fighter.staticData.id,
                                                path:"achievements",
                                                value:fighter.staticData.achievements
                                            })
                                        }
                                    }

                                    responseObj = {
                                        embeds:populateCombatWindow(session),
                                        components:populateReturnFromCombat(session)
                                    }
                                    callbackObj = {
                                        removeSession:session,
                                        updatePlayer:updates
                                    }
                                    respondTOEndOfTurn(responseObj,callbackObj,interaction,callback,message)
                                    break;
                            }
                        break;
                }
            } else {
                getTownDBData(session.server_id,function(town){
                    let updates = []
                    let townUpdates = []
                    let now = new Date()

                    for(var i = 0; i < session.session_data.fighters.length; i++){
                        let fighter = session.session_data.fighters[i]
                        if(session.user_ids.includes(fighter.staticData.id)){
                            // Update actual player data here
                            if(!fighter.staticData.achievements){
                                fighter.staticData.achievements = {
                                    kills:0,
                                    abilitiesUsed:0,
                                    livesLost:0,
                                    strongestAttack:0,
                                    tasksCompleted:0,
                                    dungeonsCleared:0,
                                    raidLeaderKills:0,
                                    playerBattlesWon:0
                                }
                            } 

                            fighter.staticData.lastEncounter = now.getTime()
                            

                            if(session.session_data.options.freeExplore){
                                if(session.session_data.options.settlementBattle){
                                    if(fighter.staticData.exploreRecord < fighter.staticData.exploreStreak){
                                        fighter.staticData.exploreRecord = fighter.staticData.exploreStreak
                                        session.session_data.battlelog.alerts.push("New Explore Streak Record!: " + fighter.staticData.exploreStreak)
                                    }
                                    fighter.staticData.exploreStreak = 0
                                    delete session.session_data.options.settlementBattle
                                }
                                if(fighter.staticData.exploreStreak == 6){
                                    fighter.staticData.leaderEncounter = 25
                                }

                                if(fighter.staticData.exploreStreak >= 6){
                                    fighter.staticData.leaderEncounter -= session.session_data.turn
                                    if(fighter.staticData.leaderEncounter > 0){
                                        session.session_data.battlelog.alerts.push("A settlement leader is approaching! (" + fighter.staticData.leaderEncounter + " turns)")
                                    } else {
                                        session.session_data.battlelog.alerts.push("A settlement leader is near by! Prepare for a tough fight!")
                                    }
                                }
                            }

                            if(session.session_data.winners.includes(fighter.staticData.id)){
                                if(fighter.staticData.exploreStreak > 0){
                                    let streakText = "Exploration Streak x" + fighter.staticData.exploreStreak + "!"
                                    if(!fighter.staticData.exploreRecord){
                                        fighter.staticData.exploreRecord = 0
                                    }
                                    if(fighter.staticData.exploreRecord > fighter.staticData.exploreStreak){
                                        streakText += "\n(Record Streak: " + fighter.staticData.exploreRecord + ")" 
                                    } else {
                                        fighter.staticData.exploreRecord = fighter.staticData.exploreStreak
                                        streakText += "\nNew Explore Streak Record!: " + fighter.staticData.exploreStreak
                                    }
                                    session.session_data.battlelog.alerts.push(streakText)
                                    let result = parseReward({
                                        type:"resource",
                                        resource:"exp",
                                        resourceName: "exp",
                                        amount: Math.ceil(fighter.staticData.expCap * (0.02 + (0.01) * fighter.staticData.exploreStreak))
                                    }, fighter.staticData)
                                    fighter.staticData = result[0]
                                    if(result[1].length > 0){
                                        for(msg of result[1]){
                                            session.session_data.battlelog.rewards.push(msg)
                                        }
                                    }
                                }
                            }
                            
                            if(fighter.staticData.statGrowthTimer < now.getTime()){
                                let growthMessage = fighter.staticData.name + "'s stats slightly grew!"
                                if(fighter.records.timesBlocked < fighter.records.timesHit){
                                    if(fighter.records.spattacks > fighter.records.attacks){
                                        fighter.staticData.stats.spatk++
                                        fighter.staticData.stats.spd++
                                        growthMessage += "\n(+1 SPATK / +1 SPD)"
                                    } else if(fighter.records.spattacks < fighter.records.attacks){
                                        fighter.staticData.stats.atk++
                                        fighter.staticData.stats.spd++
                                        growthMessage += "\n(+1 ATK / +1 SPD)"
                                    } else {
                                        fighter.staticData.stats.hp++
                                        fighter.staticData.stats.spd++
                                        growthMessage += "\n(+1 HP / +1 SPD)"
                                    }
                                    session.session_data.battlelog.rewards.push(growthMessage)
                                    fighter.staticData.statGrowthTimer = now.getTime() + 7700000
                                } else if(fighter.records.timesBlocked < fighter.records.timesHit){
                                    if(fighter.records.spguards > fighter.records.guards){
                                        fighter.staticData.stats.spdef++
                                        fighter.staticData.stats.hp++
                                        growthMessage += "\n(+1 HP / +1 SPDEF)"
                                    } else if(fighter.records.spguards < fighter.records.guards){
                                        fighter.staticData.stats.def++
                                        fighter.staticData.stats.hp++
                                        growthMessage += "\n(+1 HP / +1 DEF)"
                                    } else {
                                        fighter.staticData.stats.hp++
                                        fighter.staticData.stats.spd++
                                        growthMessage += "\n(+1 HP / +1 SPD)"
                                    }
                                    session.session_data.battlelog.rewards.push(growthMessage)
                                    fighter.staticData.statGrowthTimer = now.getTime() + 7700000
                                }
                            }

                            if(town){
                                if(town.raid){
                                    let missions = town.raid.missions
                                    let preTownPoints = town.points
                                    for(x in missions){
                                        let tier = missions[x]
                                        for(m of tier){
                                            if(!m.completers){
                                                m.completers = {}
                                            }
                                            switch(x){
                                                case "0":
                                                    switch(m.type){
                                                        case 0:
                                                            if(fighter.records.attacks > 0){
                                                                if(!m.completers[fighter.staticData.id]){
                                                                    m.completers[fighter.staticData.id] = {
                                                                        times:0,
                                                                        progression:[fighter.records.attacks,raidPresets.missionGoalValues[x][m.type]]
                                                                    }
                                                                } else {
                                                                    m.completers[fighter.staticData.id].progression[0] += fighter.records.attacks
                                                                }
                                                                while(m.completers[fighter.staticData.id].progression[0] >= m.completers[fighter.staticData.id].progression[1]){
                                                                    m.completers[fighter.staticData.id].progression[0] -= m.completers[fighter.staticData.id].progression[1]
                                                                    m.completers[fighter.staticData.id].times++
                                                                    town.points++
                                                                }
                                                            }
                                                            break;

                                                        case 1:
                                                            if(fighter.records.spattacks > 0){
                                                                if(!m.completers[fighter.staticData.id]){
                                                                    m.completers[fighter.staticData.id] = {
                                                                        times:0,
                                                                        progression:[fighter.records.spattacks,raidPresets.missionGoalValues[x][m.type]]
                                                                    }
                                                                } else {
                                                                    m.completers[fighter.staticData.id].progression[0] += fighter.records.spattacks
                                                                }
                                                                while(m.completers[fighter.staticData.id].progression[0] >= m.completers[fighter.staticData.id].progression[1]){
                                                                    m.completers[fighter.staticData.id].progression[0] -= m.completers[fighter.staticData.id].progression[1]
                                                                    m.completers[fighter.staticData.id].times++
                                                                    town.points++
                                                                }
                                                            }
                                                            break;
                                                            
                                                        case 2:
                                                            if(fighter.records.guards > 0){
                                                                if(!m.completers[fighter.staticData.id]){
                                                                    m.completers[fighter.staticData.id] = {
                                                                        times:0,
                                                                        progression:[fighter.records.guards,raidPresets.missionGoalValues[x][m.type]]
                                                                    }
                                                                } else {
                                                                    m.completers[fighter.staticData.id].progression[0] += fighter.records.guards
                                                                }
                                                                while(m.completers[fighter.staticData.id].progression[0] >= m.completers[fighter.staticData.id].progression[1]){
                                                                    m.completers[fighter.staticData.id].progression[0] -= m.completers[fighter.staticData.id].progression[1]
                                                                    m.completers[fighter.staticData.id].times++
                                                                    town.points++
                                                                }
                                                            }
                                                            break;

                                                        case 3:
                                                            if(fighter.records.spguards > 0){
                                                                if(!m.completers[fighter.staticData.id]){
                                                                    m.completers[fighter.staticData.id] = {
                                                                        times:0,
                                                                        progression:[fighter.records.spguards,raidPresets.missionGoalValues[x][m.type]]
                                                                    }
                                                                } else {
                                                                    m.completers[fighter.staticData.id].progression[0] += fighter.records.spguards
                                                                }
                                                                while(m.completers[fighter.staticData.id].progression[0] >= m.completers[fighter.staticData.id].progression[1]){
                                                                    m.completers[fighter.staticData.id].progression[0] -= m.completers[fighter.staticData.id].progression[1]
                                                                    m.completers[fighter.staticData.id].times++
                                                                    town.points++
                                                                }
                                                            }
                                                            break;

                                                        case 4:
                                                            if(fighter.records.statChanges > 0){
                                                                if(!m.completers[fighter.staticData.id]){
                                                                    m.completers[fighter.staticData.id] = {
                                                                        times:0,
                                                                        progression:[fighter.records.statChanges,raidPresets.missionGoalValues[x][m.type]]
                                                                    }
                                                                } else {
                                                                    m.completers[fighter.staticData.id].progression[0] += fighter.records.statChanges
                                                                }
                                                                while(m.completers[fighter.staticData.id].progression[0] >= m.completers[fighter.staticData.id].progression[1]){
                                                                    m.completers[fighter.staticData.id].progression[0] -= m.completers[fighter.staticData.id].progression[1]
                                                                    m.completers[fighter.staticData.id].times++
                                                                    town.points++
                                                                }
                                                            }
                                                            break;
                                                    }
                                                    break;

                                                case "1":
                                                    switch(m.type){
                                                        case 0:
                                                            if(fighter.records.weaponsLooted > 0){
                                                                if(!m.completers[fighter.staticData.id]){
                                                                    m.completers[fighter.staticData.id] = {
                                                                        times:0,
                                                                        progression:[fighter.records.weaponsLooted,raidPresets.missionGoalValues[x][m.type]]
                                                                    }
                                                                } else {
                                                                    m.completers[fighter.staticData.id].progression[0] += fighter.records.weaponsLooted
                                                                }
                                                                while(m.completers[fighter.staticData.id].progression[0] >= m.completers[fighter.staticData.id].progression[1]){
                                                                    m.completers[fighter.staticData.id].progression[0] -= m.completers[fighter.staticData.id].progression[1]
                                                                    m.completers[fighter.staticData.id].times++
                                                                    town.points += 2
                                                                }
                                                            }
                                                            break;

                                                        case 1:
                                                            if(fighter.records.gearLooted > 0){
                                                                if(!m.completers[fighter.staticData.id]){
                                                                    m.completers[fighter.staticData.id] = {
                                                                        times:0,
                                                                        progression:[fighter.records.gearLooted,raidPresets.missionGoalValues[x][m.type]]
                                                                    }
                                                                } else {
                                                                    m.completers[fighter.staticData.id].progression[0] += fighter.records.gearLooted
                                                                }
                                                                while(m.completers[fighter.staticData.id].progression[0] >= m.completers[fighter.staticData.id].progression[1]){
                                                                    m.completers[fighter.staticData.id].progression[0] -= m.completers[fighter.staticData.id].progression[1]
                                                                    m.completers[fighter.staticData.id].times++
                                                                    town.points += 2
                                                                }
                                                            }
                                                            break;
                                                            
                                                        case 2:
                                                            if(fighter.records.raresDefeated > 0){
                                                                if(!m.completers[fighter.staticData.id]){
                                                                    m.completers[fighter.staticData.id] = {
                                                                        times:0,
                                                                        progression:[fighter.records.raresDefeated,raidPresets.missionGoalValues[x][m.type]]
                                                                    }
                                                                } else {
                                                                    m.completers[fighter.staticData.id].progression[0] += fighter.records.raresDefeated
                                                                }
                                                                while(m.completers[fighter.staticData.id].progression[0] >= m.completers[fighter.staticData.id].progression[1]){
                                                                    m.completers[fighter.staticData.id].progression[0] -= m.completers[fighter.staticData.id].progression[1]
                                                                    m.completers[fighter.staticData.id].times++
                                                                    town.points += 2
                                                                }
                                                            }
                                                            break;
                                                    }
                                                    break;
                                            }
                                        }
                                    }
                                    if(session.session_data.options.raidMission){
                                        switch(session.session_data.options.raidMission.missionLevel){
                                            case 0:
                                                if(session.user_ids.includes(session.session_data.winners[0])){
                                                    let m = town.raid.missions[2][0]
                                                    if(!m.completers){
                                                        m.completers = {}
                                                    }
                                                    if(!m.completers[fighter.staticData.id]){
                                                        m.completers[fighter.staticData.id] = {
                                                            times:0,
                                                            progression:[1,raidPresets.missionGoalValues[2][session.session_data.options.raidMission.type]]
                                                        }
                                                    } else {
                                                        m.completers[fighter.staticData.id].progression[0] += 1
                                                    }
                                                    while(m.completers[fighter.staticData.id].progression[0] >= m.completers[fighter.staticData.id].progression[1]){
                                                        m.completers[fighter.staticData.id].progression[0] -= m.completers[fighter.staticData.id].progression[1]
                                                        m.completers[fighter.staticData.id].times++
                                                        town.points += 3
                                                    }
                                                }
                                                break;

                                            case 1:
                                                if(session.user_ids.includes(session.session_data.winners[0])){
                                                    let m = town.raid.bossDefeats
                                                    let bossGoldReward;
                                                    if(!m){
                                                        m = {}
                                                    }
                                                    if(!m[fighter.staticData.id]){
                                                        m[fighter.staticData.id] = {
                                                            times:1
                                                        }
                                                        result = parseReward(town.raid.leader.equipment, fighter.staticData)
                                                        fighter.staticData = result[0]

                                                        if(result[1].length > 0){
                                                            for(msg of result[1]){
                                                                session.session_data.battlelog.rewards.push(msg)
                                                            }
                                                        }

                                                        result = parseReward({
                                                            type:"resource",
                                                            resource:"exp",
                                                            resourceName: "experience",
                                                            amount: fighter.staticData.expCap
                                                        }, fighter.staticData)
                                                        fighter.staticData = result[0]

                                                        if(result[1].length > 0){
                                                            for(msg of result[1]){
                                                                session.session_data.battlelog.rewards.push(msg)
                                                            }
                                                        }

                                                        bossGoldReward = 300
                                                        town.points += 15
                                                    } else {
                                                        town.points += 4
                                                        bossGoldReward = 100
                                                        m[fighter.staticData.id].times += 1
                                                    }
                                                    result = parseReward({
                                                        type:"resource",
                                                        resource:"gold",
                                                        resourceName: "gold",
                                                        amount: bossGoldReward * town.level
                                                    }, fighter.staticData)
                                                    fighter.staticData = result[0]

                                                    if(result[1].length > 0){
                                                        for(msg of result[1]){
                                                            session.session_data.battlelog.rewards.push(msg)
                                                        }
                                                    }
                                                    town.raid.bossDefeats = m
                                                    fighter.staticData.achievements.raidLeaderKills++
                                                }
                                                break;
                                        }
                                        
                                    }

                                    if(preTownPoints != town.points){
                                        session.session_data.battlelog.alerts.push("✅ Town Militia Supported ✅")
                                        session.session_data.battlelog.alerts.push(town.name + " gained " + (town.points - preTownPoints) + " point(s)")
                                        session.session_data.battlelog.alerts.push("---")
                                    }
                                }

                                if(session.session_data.options.encounterRewards){
                                    if(session.user_ids.includes(session.session_data.winners[0])){
                                        if(town.reputations[fighter.staticData.id] >= 10 * session.session_data.options.encounterRewards.val){
                                            session.session_data.battlelog.rewards.push(fighter.staticData.name + "'s efforts to protect the town and it's people are greatly appreciated!")
                                            session.session_data.battlelog.rewards.push(10 * session.session_data.options.encounterRewards.val + " town reputation has been exchanged for your reward")
                                            session.session_data.battlelog.rewards.push("(" + town.reputations[fighter.staticData.id] + " reputation remaining)")
                                            session.session_data.battlelog.rewards.push("---")
                                            town.reputations[fighter.staticData.id] -= 10 * session.session_data.options.encounterRewards.val
                                            if(town.reputations[fighter.staticData.id] <= 0){
                                                town.reputations[fighter.staticData.id] = 0
                                            }
                                            townUpdates.push({
                                                id:session.server_id,
                                                path:"reputations/" + fighter.staticData.id,
                                                value:town.reputations[fighter.staticData.id]
                                            })

                                            let result;

                                            if(session.session_data.options.encounterRewards.type == "extTown"){
                                                result = parseReward({
                                                    type:"resource",
                                                    resource:"exp",
                                                    resourceName: "experience",
                                                    amount: Math.ceil(200 * session.session_data.options.encounterRewards.val)
                                                }, fighter.staticData)
                                                fighter.staticData = result[0]

                                                if(result[1].length > 0){
                                                    for(msg of result[1]){
                                                        session.session_data.battlelog.rewards.push(msg)
                                                    }
                                                }
                                            }

                                            if(session.session_data.options.encounterRewards.type == "intTown"){
                                                result = parseReward({
                                                    type:"resource",
                                                    resource:"gold",
                                                    resourceName: "gold",
                                                    amount: Math.ceil(100 * session.session_data.options.encounterRewards.val)
                                                }, fighter.staticData)
                                                fighter.staticData = result[0]

                                                if(result[1].length > 0){
                                                    for(msg of result[1]){
                                                        session.session_data.battlelog.rewards.push(msg)
                                                    }
                                                }
                                            }

                                            switch(Math.ceil(Math.random() * 3)){
                                                case 1:
                                                    let newData = {
                                                        ref:{
                                                            type: "rngEquipment",
                                                            rngEquipment: {
                                                                scaling: false,
                                                                value:1,
                                                                conStats:1,
                                                                conValue:0.1,
                                                                lockStatTypes: true,
                                                                baseVal: 8 * session.session_data.options.encounterRewards.val,
                                                                types: ["weapon","gear"]
                                                            }
                                                        }
                                                    }
                                    
                                                    let player = fighter.staticData
                                    
                                                    let item = generateRNGEquipment(newData)
                                                    fighter.staticData = givePlayerItem(item,player)
                                                    let rewardsText = ""; 
                                                    if(item.type == "weapon"){
                                                        rewardsText += player.name + " received equipment: " + item.name + " 🗡️"
                                                    } else {
                                                        rewardsText += player.name + " received equipment: " + item.name + " 🛡️"
                                                    }
                                                    session.session_data.battlelog.rewards.push(rewardsText)
                                                    break;

                                                case 2:
                                                    result = parseReward({
                                                        type:"resource",
                                                        resource:"abilitypoints",
                                                        resourceName: "ability points",
                                                        amount: Math.floor(session.session_data.options.encounterRewards.val * 6)
                                                    }, fighter.staticData)
                                                    fighter.staticData = result[0]

                                                    if(result[1].length > 0){
                                                        for(msg of result[1]){
                                                            session.session_data.battlelog.rewards.push(msg)
                                                        }
                                                    }
                                                    break;
                                                
                                                case 3:
                                                    result = parseReward({
                                                        type:"resource",
                                                        resource:"statpoints",
                                                        resourceName: "skill points",
                                                        amount: Math.ceil(session.session_data.options.encounterRewards.val * 2)
                                                    }, fighter.staticData)
                                                    fighter.staticData = result[0]

                                                    if(result[1].length > 0){
                                                        for(msg of result[1]){
                                                            session.session_data.battlelog.rewards.push(msg)
                                                        }
                                                    }
                                                    break;
                                            }
                                        } else {
                                            session.session_data.battlelog.rewards.push("The townspeople lightly cheer and throw gold coins before dispersing...\n\nIncrease your reputation with the town by doing tasks to earn greater rewards\n")

                                            let result = parseReward({
                                                type:"resource",
                                                resource:"gold",
                                                resourceName: "gold",
                                                amount: 25 + Math.floor(Math.random() * 76)
                                            }, fighter.staticData)
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

                            fighter.staticData.achievements.kills += fighter.records.unitsDefeated
                            fighter.staticData.achievements.abilitiesUsed += fighter.records.attacks
                            fighter.staticData.achievements.abilitiesUsed += fighter.records.guards
                            fighter.staticData.achievements.abilitiesUsed += fighter.records.statChanges
                            if(fighter.staticData.achievements.strongestAttack < fighter.records.strongestStrike){
                                fighter.staticData.achievements.strongestAttack = fighter.records.strongestStrike
                            }
                            

                            let challengesCompleted = 0;
                            let totalGoldReward = 0;
                            let totalSPReward = 0
                            if(fighter.staticData.challenges && fighter.staticData.tutorial == "completed"){
                                for(var i = 0; i < fighter.staticData.challenges.length;i++){
                                    let c = fighter.staticData.challenges[i]
                                    let progressVal = 0;
                                    switch(c.type){
                                        case 0:
                                            progressVal = fighter.records.unitsDefeated
                                            break;

                                        case 1:
                                            progressVal = fighter.records.enemyDamageTaken
                                            break;

                                        case 2:
                                            progressVal = fighter.records.baseDamageBlocked
                                            break;

                                        case 3:
                                            progressVal = fighter.records.attackDamageDone
                                            break;

                                        case 4:
                                            progressVal = fighter.records.timesFirstAttack
                                            break;

                                        case 5:
                                            progressVal = fighter.records.criticalsLanded
                                            break;

                                        case 6:
                                            progressVal = fighter.records.counterDamageDone
                                            break;

                                        case 7:
                                            progressVal = fighter.records.completeBlocks
                                            break;

                                        case 8:
                                            progressVal = fighter.records.timesStatsRaised
                                            break;

                                        case 9:
                                            progressVal = fighter.records.timesStatsLowered
                                            break;

                                        case 10:
                                            progressVal = fighter.records.timesAbilityRepeat
                                            break;

                                        case 11:
                                            progressVal = fighter.records.empoweredAbilities
                                            break;

                                        case 12:
                                            progressVal = fighter.records.stanceSwitches
                                            break;

                                        case 13:
                                            progressVal = fighter.records.strongestStrike
                                            break;

                                        case 14:
                                            progressVal = fighter.records.effectiveAttacks
                                            break;

                                        case 15:
                                            progressVal = fighter.records.attacksResisted
                                            break;
                                    }

                                    if(progressVal > 0){
                                        if(c.type == 13){
                                            c.progress = 0
                                        }
                                        c.progress += progressVal
                                        if(c.goal <= c.progress){
                                            challengesCompleted++
                                            totalGoldReward += c.rank * 50
                                            totalSPReward += c.rank * 10
                                            session.session_data.battlelog.rewards.push("✅" + challengeDict[c.type].name + " - Rank " + c.rank + ": Complete! ✅")
                                            fighter.staticData.challenges.splice(i,1)
                                            i--
                                        } else {
                                            session.session_data.battlelog.alerts.push("Challenge Progress: " + challengeDict[c.type].name + ": " + Math.round(c.progress) + "/" + c.goal)
                                        }
                                    }
                                }

                                if(totalGoldReward > 0){
                                    session.session_data.battlelog.rewards.push("---") 
                                    let result = parseReward({
                                        type:"resource",
                                        resource:"gold",
                                        resourceName: "gold",
                                        amount: totalGoldReward * challengesCompleted
                                    }, fighter.staticData)
                                    fighter.staticData = result[0]
                                    if(result[1].length > 0){
                                        for(msg of result[1]){
                                            session.session_data.battlelog.rewards.push(msg)
                                        }
                                    }

                                    result = parseReward({
                                        type:"resource",
                                        resource:"abilitypoints",
                                        resourceName: "ability points",
                                        amount: totalSPReward * challengesCompleted
                                    }, fighter.staticData)
                                    fighter.staticData = result[0]
                                    if(result[1].length > 0){
                                        for(msg of result[1]){
                                            session.session_data.battlelog.rewards.push(msg)
                                        }
                                    }
                                }
                            }

                            if(session.session_data.options.combatTest){
                                fighter.staticData.tutorial = 6
                                session.session_data.battlelog.alerts.push("Well Done! You earned a lot of gold from that fight! Head to town to see the different facilities where you can spend it! (`/town`)")
                            }

                            updates.push({
                                id:fighter.staticData.id,
                                path:"",
                                value:fighter.staticData
                            })
                        }
                    }
                    
                    

                    if(session.session_data.options.combatRewards){
                        let rewards = session.session_data.options.combatRewards
                        if(rewards.overwriteHallOwner){
                            if(session.user_ids.includes(session.session_data.winners[0])){
                                let newOwner = rewards.overwriteHallOwner
                                if(session.session_data.fighters[1].staticData.prevID != session.session_data.winners[0]){
                                    newOwner.id = "playerClone"
                                    newOwner.name = "Shadow of " + newOwner.name
                                    newOwner.prevID = session.session_data.winners[0]
                                    townUpdates.push({
                                        id:session.server_id,
                                        path:"hallOwner",
                                        value:newOwner
                                    })
                                    
                                    townUpdates.push({
                                        id:session.server_id,
                                        path:"hallStart",
                                        value:now.getTime()
                                    })  
                                }
                            }
                        }    
                    }
                    if(town.raid){
                        townUpdates.push({
                            id:session.server_id,
                            path:"raid",
                            value:town.raid
                        })

                        townUpdates.push({
                            id:session.server_id,
                            path:"points",
                            value:town.points
                        })
                    }

                    responseObj = {
                        embeds:populateCombatWindow(session),
                        components:populateCombatControls(session)
                    }

                    callbackObj = {
                        removeSession:session,
                        updatePlayer:updates,
                        updateTown:townUpdates 
                    }
                    respondTOEndOfTurn(responseObj,callbackObj,interaction,callback,message)
                })
            }
        } else {
            if(session.session_data.options.returnSession){
                responseObj = {
                    embeds:populateCombatWindow(session),
                    components:populateReturnFromCombat(session,session.session_data.options.getRankingStats)
                }

                let updates;

                if(session.session_data.combatLesson && session.session_data.winners.includes(session.session_data.fighters[0].staticData.id)){
                    updates = [
                        {
                            session:session.session_data.options.returnSession,
                            prop:"lessonNum",
                            val:parseInt(session.session_data.combatLesson.split("lesson")[1])
                        }
                    ]
                }

                
                
                callbackObj = {
                    unHoldSession:session.session_data.options.returnSession,
                    updateSessionPlayer:updates,
                    removeSession:session
                }
                respondTOEndOfTurn(responseObj,callbackObj,interaction,callback,message)
            } else {
                responseObj = {
                    embeds:populateCombatWindow(session),
                    components:populateCombatControls(session)
                }

                callbackObj = {
                    removeSession:session
                }
                respondTOEndOfTurn(responseObj,callbackObj,interaction,callback,message)
            }
        }
    } else {
        if(error != ""){
            interaction.reply({ content: error, ephemeral: true });
            responded = true
        } else {
            responseObj = {
                embeds:populateCombatWindow(session),
                components:populateCombatControls(session)
            }
        }
        callbackObj = {
            updateSession:session
        }

        if(!responded){
            respondTOEndOfTurn(responseObj,callbackObj,interaction,callback,message)
        }
    }
}

function cropString(string,limit){
    if(string.length > limit){
        string = string.slice(0,limit - 3) + "..."
    }
    return string
}

function readableLog(log){
    let lines = []
    let logTypes = ["dialogue","combat","alerts","rewards"]
    for(i in log){
        let turn = log[i]
        lines.push("< TURN #" + (parseInt(i)+1) + " >")
        for(type of logTypes){
            if(turn[type]){
                for(entry of turn[type]){
                    lines.push(entry)
                }
            }
        }
    }
    return lines
}

function getPassive(fighter, passiveID){
    if(fighter.passives){
        for(var i = 0; i < fighter.passives;i++){
            if(fighter.passives[i].id == passiveID){
                return fighter.passives[i]
            }
        }
    } else {
        return null
    }
}

function handleStatChange(session,unit,amount,stat,log = "combat",set = false){
    let msg;
    if(set){    
        unit.liveData.statChanges[stat] = amount
        msg = unit.staticData.name + "'s " + stat + " multiplier set to x" +  statChangeStages[amount]
    } else {
        unit.liveData.statChanges[stat] += amount
        if(unit.liveData.statChanges[stat] > 16){
            unit.liveData.statChanges[stat] = 16
            msg = unit.staticData.name + "'s " + stat + " is maxed!"
        } else if(unit.liveData.statChanges[stat] < 0){
            unit.liveData.statChanges[stat] = 0
            msg = unit.staticData.name + "'s " + stat + " can't be lowered!"
        } else {
            msg = unit.staticData.name + "'s " + stat + (amount > 0 ? " increased!" : " decreased!") + " (x" + statChangeStages[unit.liveData.statChanges[stat]] + ")"
        }
    }
    session.session_data.battlelog[log].push(msg)
}

function manageBossAction(boss,session){
    let fighters = session.session_data.fighters
    switch(boss.staticData.highestStat){
        case "hp":
            session.session_data.battlelog.alerts.push(boss.staticData.name + " lets out a deafening roar!")
            for(f of fighters){
                if(f.team != boss.team){
                    handleStatChange(session,f,5,"atk","alerts",true)
                    handleStatChange(session,f,5,"spatk","alerts",true)
                }
            }
            break;

        case "atk":
            session.session_data.battlelog.alerts.push(boss.staticData.name + " shouts with rage!")
            handleStatChange(session,boss,13,"atk","alerts",true)
            handleStatChange(session,boss,13,"spd","alerts",true)
            break;

        case "def":
            session.session_data.battlelog.alerts.push(boss.staticData.name + " hardens their resolve!")
            handleStatChange(session,boss,16,"def","alerts",true)
            break;

        case "spatk":
            session.session_data.battlelog.alerts.push(boss.staticData.name + " intensely focuses!")
            handleStatChange(session,boss,13,"spatk","alerts",true)
            handleStatChange(session,boss,13,"spd","alerts",true)
            break;

        case "spdef":
            session.session_data.battlelog.alerts.push(boss.staticData.name + " clears their mind!")
            handleStatChange(session,boss,16,"spdef","alerts",true)
            break;

        case "spd":
            session.session_data.battlelog.alerts.push(boss.staticData.name + " rushes into their opponents!")
            for(f of fighters){
                if(f.team != boss.team){
                    handleStatChange(session,f,3,"def","alerts",true)
                    handleStatChange(session,f,3,"spdef","alerts",true)
                }
            }
            break;
    }

    switch(Math.floor(Math.random() * 3)){
        case 0:
            session.session_data.battlelog.alerts.push(boss.staticData.name + " summons a devout servant to their side!")
            let stat = ["atk","spatk"][Math.floor(Math.random() * 2)]
            let hunterUnit = {
                name: boss.staticData.name + "'s Trusted",
                id:Math.floor(Math.random() * 1000),
                cpu:true,
                faction:"-1",
                race:"0",
                combatStyle:"0",
                exp:0,
                abilitypoints:0,
                statpoints:0,
                lives:2,
                abilities:[{
                    "critical": 25,
                    "damage_type": stat,
                    "damage_val": 70,
                    "name": boss.staticData.name + "'s Order",
                    "speed": 2,
                    "faction": -1,
                    "action_type": "attack",
                    "numHits": 1,
                    "recoil": 0,
                    "targetType": "1",
                    "accuracy": 95
                },{
                    "action_type": "guard",
                    "name": boss.staticData.name + "'s Veil",
                    "guard_val": 100,
                    "guard_type": "spdef",
                    "success_level": "100",
                    "counter_val": 0,
                    "counter_type": "def",
                    "speed": 3
                }],
                level:1,
                totalExp:0,
                passives:[],
                stats:{
                    "hp":10,
                    "atk":1,
                    "def":1,
                    "spatk":1,
                    "spdef":1,
                    "spd":1
                }
            }

            hunterUnit.stats[stat] = boss.staticData.level * 25;

            let fighterData = prepCombatFighter(hunterUnit,session.session_data.fighters.length)
            fighterData.team = boss.team 
            session.session_data.battlelog.alerts.push(fighterData.staticData.name + " has entered combat!")
            session.session_data.fighters.push(fighterData)
            break;

        case 1:
            session.session_data.battlelog.alerts.push("Under pressure, " + boss.staticData.name + " lashes out wildly in an act of desperation!")
            boss.liveData.stats.hp = Math.floor(boss.liveData.maxhp * 0.5)
            for(f of fighters){
                if(f.team != boss.team){
                    f.liveData.stats.hp -= Math.floor(f.liveData.maxhp * 0.33)
                    if(f.liveData.stats.hp < Math.floor(f.liveData.maxhp * 0.05)){
                        f.liveData.stats.hp = Math.floor(f.liveData.maxhp * 0.05)
                    }
                }
            }
            break;

        case 2:
            session.session_data.battlelog.alerts.push("A surge of mysterious energy pulses from " + boss.staticData.name + "'s equipment!")
            switch(Math.floor(Math.random() * 2)){
                case 0:
                    if(boss.weapon){
                        boss.weapon.stats.baseAtkBoost += 10
                        boss.weapon.stats.baseSpAtkBoost += 10
                    } else {
                        boss.gear.stats.baseAtkBoost += 10
                        boss.gear.stats.baseSpAtkBoost += 10
                    }

                    session.session_data.battlelog.alerts.push(boss.staticData.name + "'s equipment has had it's offensive capabilities boosted!")
                    break;

                case 1:
                    if(boss.weapon){
                        boss.weapon.stats.baseDefBoost += 5
                        boss.weapon.stats.baseSpDefBoost += 5
                    } else {
                        boss.gear.stats.baseDefBoost += 5
                        boss.gear.stats.baseSpDefBoost += 5
                    }

                    session.session_data.battlelog.alerts.push(boss.staticData.name + "'s equipment has had it's defensive capabilities boosted!")
                    break;
            }
            break;
    }
}

function increaseComboMeter(unit,value){
    if(unit.meter != undefined){
        if(value > 0 && unit.staticData.stance == "spd" && unit.staticData.stances.spd.upgrades[2] > 0){
            let buffData = getStanceBuffValues("spd",unit.staticData.stances,2)
            if(Math.random() < buffData.val/100){
                value *= 2
            }
        }
        unit.meter += value
        while(unit.meter > 30){
            if(unit.staticData.meterRank < 3){
                unit.staticData.meterRank++
                unit.meter -= 30
            } else {
                unit.meter = 30
            }
        }
    }
}

function manageCriticalPoint(session,pointHolder,attacker,point){
    if(attacker.meter != undefined){
        increaseComboMeter(attacker,10)
    }
    switch(point){
        case "loot":
            if(pointHolder.staticData.droptable){
                let times = weightedRandom([
                    {
                        chance:30,
                        obj:1
                    },
                    {
                        chance:50,
                        obj:2
                    },
                    {
                        chance:20,
                        obj:3
                    }
                ])
                for(var i = 0; i < times; i++){
                    let drop = weightedRandom(pointHolder.staticData.droptable)
                    result = parseReward(drop,attacker.staticData,pointHolder)
                    if(result[2]){
                        switch(result[2].type){
                            case "gear":
                                attacker.records.gearLooted++
                                break;

                            case "weapon":
                                attacker.records.weaponsLooted++
                                break;
                        }
                    }
                    attacker.staticData = result[0]
                    if(result[1].length > 0){
                        for(msg of result[1]){
                            session.session_data.battlelog.rewards.push(msg)
                        }
                    }
                }

                drop = {
                    type:"resource",
                    resource:"exp",
                    resourceName: "bonus experience",
                    amount: Math.ceil(attacker.staticData.expCap * 0.1)
                }      
                result = parseReward(drop,attacker.staticData)
                attacker.staticData = result[0]
                if(result[1].length > 0){
                    for(msg of result[1]){
                        session.session_data.battlelog.rewards.push(msg)
                    }
                }
            } else {
                let drop = {
                    type:"resource",
                    resource:"exp",
                    resourceName: "bonus experience",
                    amount: Math.ceil(attacker.staticData.expCap * 0.1)
                }     
                result = parseReward(drop,attacker.staticData)
                attacker.staticData = result[0]
                if(result[1].length > 0){
                    for(msg of result[1]){
                        session.session_data.battlelog.rewards.push(msg)
                    }
                }

                drop = {
                    type:"resource",
                    resource:"gold",
                    resourceName: "gold",
                    amount: Math.ceil(pointHolder.staticData.level * 10)
                }     
                result = parseReward(drop,attacker.staticData)
                attacker.staticData = result[0]
                if(result[1].length > 0){
                    for(msg of result[1]){
                        session.session_data.battlelog.rewards.push(msg)
                    }
                }
            }
            break;

        case "weak":
            let stats = ["atk","def","spdef","spatk","spd"]
            let markedStats = [] 
            let times = weightedRandom([
                {
                    chance:75,
                    obj:2
                },
                {
                    chance:20,
                    obj:3
                },
                {
                    chance:5,
                    obj:4
                }
            ])
            for(var i = 0; i < times; i++){
                let highestVal = 0
                let highest = ""
                for(var s of stats){
                    if(pointHolder.liveData.stats[s] * statChangeStages[pointHolder.liveData.statChanges[s]] > highestVal){
                        highestVal = pointHolder.liveData.stats[s] * statChangeStages[pointHolder.liveData.statChanges[s]]
                        highest = s
                    }
                }
                markedStats.push(highest)
                stats.splice(stats.indexOf(highest),1)
            }
            for(mS of markedStats){
                handleStatChange(session,pointHolder,3,mS,"alerts",true)
            }
            session.session_data.battlelog.alerts.push("---")
            break;
    }
}

function printFighter(fighter,emojis = true){
    let name = ""
    if(fighter.staticData.region && emojis){
        name = regionsEmojis[fighter.staticData.region] + fighter.staticData.name + regionsEmojis[fighter.staticData.region]
    } else {
        name = fighter.staticData.name
    }
    return name 
}

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
                let conditionsMet = true
                if(triggerData.conditions){
                    conditionsMet = false
                    for(c in triggerData.conditions){
                        switch(c){
                            case "unitAlive":
                                for(fighter of session.session_data.fighters){
                                    if(triggerData.conditions[c].includes(fighter.staticData.id) && fighter.alive){
                                        conditionsMet = true;
                                    }
                                }
                                break;
                        }    
                    }
                }
                if(conditionsMet){
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
    session.session_data.livingFighters = 0
    for(fighter of session.session_data.fighters){
        if(!fighter.forfeit && fighter.alive){
            session.session_data.livingFighters++
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
            if(fighter.alive && !fighter.forfeit && fighter.staticData.cpu == undefined){
                NonCPUPlayersLeft.push(fighter.staticData.id)
            }
        }
    
        if(NonCPUPlayersLeft.length == 0){
            session.session_data.completed = true   
            session.session_data.battlelog.alerts.push("No Players Remaining: Combat Ended")
        }
    }
}

function parseAbilityToOrder(ability,fighters,fighter){
    let targets = []
    if(ability.action_type == "attack"){
        let fighterTarget = fighter.target
        if(fighterTarget == -1){
            let possibleTargets = []
            for(f of fighters){
                if(f.team != fighter.team){
                    possibleTargets.push(f.index)
                }
            }
            fighter.target = possibleTargets[Math.floor(Math.random() * possibleTargets.length)]
        }
        switch(parseInt(ability.targetType)){
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
    }
    return [targets,ability]
}

function getAbilityOrder(fighters){
    let actionCount = 0
    let abilityOrder = [
        [],
        [],
        [],
        [],
        []
    ]

    for(fighter of fighters){
        if(fighter.staticData.abilities){
            if(fighter.stanceSwitch == undefined && fighter.alive && fighter.choosenAbility != -2 && fighter.staticData.abilities.length > 0){
                let parseResult;
                if(fighter.staticData.signature){
                    let healthMulti = fighter.liveData.stats.hp/fighter.liveData.maxhp <= 0.25 ? 2 : 1
                    if(Math.random() * 100 <= 10 + (fighter.staticData.level * 0.9 * healthMulti)){
                        parseResult = parseAbilityToOrder(fighter.staticData.signature,fighters,fighter)
                        let signatureAbility = clone(parseResult[1])
                        signatureAbility.name = "Signature Ability: " + signatureAbility.name
                        abilityOrder[parseResult[1].speed].push({
                            index:fighter.index,
                            ability:signatureAbility,
                            targets:parseResult[0]
                        })
                    }
                }
                parseResult = parseAbilityToOrder(fighter.staticData.abilities[fighter.choosenAbility],fighters,fighter)
                abilityOrder[parseResult[1].speed].push({
                    index:fighter.index,
                    ability:clone(parseResult[1]),
                    targets:parseResult[0]
                })
                actionCount++
            } else if (fighter.stanceSwitch){
                abilityOrder[1].push({
                    index:fighter.index,
                    ability:{
                        "action_type":"stance",
                        "stance":fighter.stanceSwitch
                    }
                })
                delete fighter.stanceSwitch
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

    abilityOrder = abilityOrder.reverse()

    return [abilityOrder,actionCount]
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

    if(session.session_data.options.canPerfect){
        let fighters = session.session_data.fighters
        for(fighter of fighters){
            if(fighter.team != mob.team && !fighter.staticData.cpu){
                console.log(fighter.records.enemyDamageTaken,fighter.records.recoilDamageTaken)
                if(fighter.records.enemyDamageTaken == 0 && fighter.records.recoilDamageTaken == 0){
                    session.session_data.battlelog.alerts.push("PERFECT KILL")
                    if(fighter.meter != undefined){
                        increaseComboMeter(fighter,15)
                    }
                    let drop = weightedRandom(standardDroptables.perfectClear)
                    if(drop == "EXP"){
                        drop = {
                            type:"resource",
                            resource:"exp",
                            resourceName: "bonus experience",
                            amount: Math.ceil(fighter.staticData.expCap * 0.075)
                        }      
                    } 
                    result = parseReward(drop,fighter.staticData)
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
    if(session.session_data.battlelog.rewards.length > 0){
        session.session_data.battlelog.rewards.push("---")
    }
}

function calculateAttackDamage(level,atkStat,defStat,baseDamage){
    console.log(level,atkStat,defStat,baseDamage)
    let levelMod = ((2 * level)/10) + 2
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
    processEndOfTurn(error,session,interaction,callback,message){
        processEndOfTurn(error,session,interaction,callback,message)
    },
    populateCloseInteractionMessage(message,nonDismiss){
        const embed = new MessageEmbed()
			.setColor('#00ff00')
			.setTitle(message)

        if(nonDismiss == undefined){
			embed.setDescription('You can now dismiss this message');
        }
        let removeRow = new MessageActionRow()
        .addComponents(
            new MessageButton()
            .setCustomId('deleteMessage')
            .setLabel("Dismiss")
            .setStyle('DANGER'))
        return {
            content: " ",
            components: [removeRow],
            embeds: [embed]
        }
    },
    populateStatEditWindow (session){
        const embed = new MessageEmbed()

        let statDescriptions = {
            "hp": "Total Hitpoints",
            "atk": "Increases damage done by physical attacks",
            "spatk": "Increases damage done by special attacks",
            "def": "Decreases damage taken from physical attacks",
            "spdef": "Decreases damage taken from physical attacks",
            "spd": "Determines how quickly you will preform abilities",
        }
    

        let displayText = ""
        displayText += "Statpoints to spend: " + session.session_data.statpoints + "\n\n"
        for(statname in session.session_data.stats){
            if(session.session_data.stats[statname] < session.session_data.prevStats[statname]){
                displayText += "-"
            }else if(session.session_data.stats[statname] > session.session_data.prevStats[statname]){
                displayText += "+"
            } 
            displayText += statname.toLocaleUpperCase() + ": " + session.session_data.stats[statname] + "\n(" + statDescriptions[statname] + ")" 
            let statpointsNeeded = session.session_data.editAmount;
            // if(session.session_data.faction != -1){
            //     if(statIncreaseRatios[session.session_data.faction][statname] > 0){
            //         statpointsNeeded = 1
            //     } else {
            //         statpointsNeeded = 1/statIncreaseRatios[session.session_data.faction][statname]
            //     }
            // } else {
            //     statpointsNeeded = 1
            // }
            if(statname == session.session_data.editingStat){
                if(session.session_data.faction != -1){
                    displayText += " (-/+) " + session.session_data.editAmount + ": Refunds/Costs " + statpointsNeeded 
                } else {
                    displayText += " (-/+) " + session.session_data.editAmount + ": Refunds/Costs " + statpointsNeeded 
                }
                
                if(statpointsNeeded > 1){
                    displayText += " statpoints"
                } else {
                    displayText += " statpoint"
                }
                
            }
            displayText += "\n\n"
        }
        displayText += "Use the </> arrows to decrease/increase a stat\n"
        displayText += "Currently Modifying by value of: " + session.session_data.editAmount + " \n"
        embed.addField(
            "Modifying Stats",
            displayText
        )
        return [embed]
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
            if(session.session_data.prevStats[session.session_data.editingStat] <= session.session_data.stats[session.session_data.editingStat] - session.session_data.editAmount){
                canDecrease = false;
            }
            let statpointsNeeded = session.session_data.editAmount;
            let stat = session.session_data.editingStat

            // if(session.session_data.faction != -1){
            //     if(statIncreaseRatios[session.session_data.faction][stat] > 0){
            //         statpointsNeeded = session.session_data.editAmount
            //     } else {
            //         statpointsNeeded = session.session_data.editAmount/statIncreaseRatios[session.session_data.faction][stat]
            //     }
            // } else {
            //     statpointsNeeded = session.session_data.editAmount
            // }
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

        const row3 = new MessageActionRow().addComponents(
            new MessageButton()
            .setCustomId('setEditVal_' + session.session_id + "_1")
            .setLabel('1')
            .setStyle('PRIMARY')
            .setDisabled(session.session_data.editAmount == 1),

            new MessageButton()
            .setCustomId('setEditVal_' + session.session_id + "_5")
            .setLabel('5')
            .setStyle('PRIMARY')
            .setDisabled(session.session_data.editAmount == 5),


            new MessageButton()
            .setCustomId('setEditVal_' + session.session_id + "_10")
            .setLabel('10')
            .setStyle('PRIMARY')
            .setDisabled(session.session_data.editAmount == 10),

            new MessageButton()
            .setCustomId('setEditVal_' + session.session_id + "_20")
            .setLabel('20')
            .setStyle('PRIMARY')
            .setDisabled(session.session_data.editAmount == 20)
    );
        return [row1,row2,row3]
    },
    populateCombatControls(session){
        return populateCombatControls(session)
    },
    populateCombatWindow(session){
        return populateCombatWindow(session)
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
            winners:[],
            livingFighters:0
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

        data.livingFighters = i

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
                    if(fighter.stanceSwitch == undefined && fighter.choosenAbility == -1 && fighter.staticData.abilities.length > 0){
                        simTurn = false
                        break;
                    }
                }
            }
        }
        if(simTurn){
            let first = true
            let schedule = getAbilityOrder(fighters)
            let actionCount = schedule[1]
            let currentActionCount = 0
            if(session.session_data.turn == 0){
                for(var i = 0; i < fighters.length;i++){
                    let fighter = session.session_data.fighters[i]
                    if(fighter.weaponPassives[3] > 0 && Math.random() < fighter.weaponPassives[3] * 0.15){
                        schedule[0][0].push({
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
                        actionCount++
                    }
                    if(fighter.gearPassives[3] > 0 && Math.random() < fighter.gearPassives[3] * 0.15){                    
                        schedule[0][0].push({
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
                        actionCount++
                    }
                }
            }
            let stancemessages = [];
            for(timePeriod of schedule[0]){
                for(action of timePeriod){
                    currentActionCount++
                    let actionCode;
                    let weaponPassives = session.session_data.fighters[action.index].weaponPassives;
                    let gearPassives = session.session_data.fighters[action.index].gearPassives;        
                    switch(action.ability.action_type){
                        case "stance":
                            let swapper = session.session_data.fighters[action.index]
                            if(swapper.alive){
                                swapper.records.stanceSwitches++
                                swapper.staticData.stance = action.ability.stance
                                session.session_data.battlelog.combat.push(swapper.staticData.name + " has switched to a " + stanceDict[action.ability.stance] + " fighting stance!")
                                if(swapper.staticData.stances[swapper.staticData.stance].upgrades[0] > 0){
                                    let val = swapper.staticData.stances[swapper.staticData.stance].upgrades[0] * stanceBuffs[swapper.staticData.stance][0].val 
                                    if(stanceBuffs[swapper.staticData.stance][0].baseval){
                                        val += stanceBuffs[swapper.staticData.stance][0].baseval
                                    }
                                    switch(swapper.staticData.stance){
                                        case "hp":
                                            session.session_data.battlelog.combat.push(swapper.staticData.name + " activated " + stanceBuffs[swapper.staticData.stance][0].name + "!")
                                            if(!swapper.shieldVal){
                                                swapper.shieldVal = 0
                                            }
                                            let shield = Math.floor(swapper.liveData.maxhp * (val/100))
                                            swapper.shieldVal += shield
                                            session.session_data.battlelog.combat.push(swapper.staticData.name + " gained a shield that can absorb up to " + shield + " damage!")
                                            break;

                                        case "atk":
                                            if(Math.random() < val/100){
                                                session.session_data.battlelog.combat.push(swapper.staticData.name + " activated " + stanceBuffs[swapper.staticData.stance][0].name + "!")
                                                for(var i = 0; i < fighters.length;i++){
                                                    if(fighters[i].team != swapper.team){
                                                        handleStatChange(session,fighters[i],6,"def",undefined,true)
                                                    }
                                                }
                                            }
                                            break;

                                        case "def":
                                            session.session_data.battlelog.combat.push(swapper.staticData.name + " activated " + stanceBuffs[swapper.staticData.stance][0].name + "!")
                                            handleStatChange(session,swapper,8 + swapper.staticData.stances[swapper.staticData.stance].upgrades[0],"def",undefined,true)
                                            handleStatChange(session,swapper,6,"atk",undefined,true)
                                            handleStatChange(session,swapper,6,"spatk",undefined,true)
                                            break;

                                        case "spatk":
                                            session.session_data.battlelog.combat.push(swapper.staticData.name + " activated " + stanceBuffs[swapper.staticData.stance][0].name + "!")
                                            if(!swapper.clearMindStacks){
                                                swapper.clearMindStacks = 0
                                            }
                                            swapper.clearMindStacks += val
                                            session.session_data.battlelog.combat.push(swapper.staticData.name + " is sharpening their mental! (" + swapper.clearMindStacks+ " bonus base damage)")
                                            break;

                                        case "spdef":
                                            if(Math.random() < val/100){
                                                session.session_data.battlelog.combat.push(swapper.staticData.name + " activated " + stanceBuffs[swapper.staticData.stance][0].name + "!")
                                                for(var i = 0; i < fighters.length;i++){
                                                    if(fighters[i].team != swapper.team){
                                                        handleStatChange(session,fighters[i],7,"atk",undefined,true)
                                                        handleStatChange(session,fighters[i],7,"spatk",undefined,true)
                                                    }
                                                }
                                            }
                                            break;
                                        
                                        case "spd":
                                            session.session_data.battlelog.combat.push(swapper.staticData.name + " activated " + stanceBuffs[swapper.staticData.stance][0].name + "!")
                                            if(swapper.staticData.meterRank > 0){
                                                handleStatChange(swapper,9 + (swapper.staticData.meterRank * 2),"spd",undefined,true)
                                                let totalMeterVal = swapper.staticData.meterRank * 30 + swapper.meter
                                                totalMeterVal -= Math.floor(totalMeterVal * (val / 100))
                                                swapper.meter = totalMeterVal % 30
                                                swapper.staticData.meterRank = Math.floor(totalMeterVal / 30)
                                            } else {
                                                handleStatChange(swapper,8,"spd",undefined,true)
                                            }
                                        }
                                }
                                    
                            }
                            break;
                        case "attack":
                            let attacker = session.session_data.fighters[action.index]                  
                            if(attacker.alive){
                                if(attacker.empowered > 0){
                                    attacker.records.empoweredAbilities++
                                    session.session_data.battlelog.combat.push(attacker.staticData.name + " is empowered! (x" + attacker.empowered + ")")
                                    action.ability.damage_val = Math.ceil(action.ability.damage_val * (1 + (attacker.empowered)))
                                    
                                    if(action.ability.accuracy * (1.25 + (0.25 * attacker.empowered)) <= 100){
                                        action.ability.accuracy *= (1.25 + (0.25 * attacker.empowered))
                                    } else {
                                        if(action.ability.accuracy < 100){
                                            action.ability.accuracy = 100
                                        }
                                    } 

                                    if(action.ability.critical == 0){
                                        action.ability.critical = 10
                                    }
                                    action.ability.critical *= 1 + (0.5 * attacker.empowered)

                                    if(action.ability.recoil > 0){
                                        action.ability.damage_val += Math.ceil((action.ability.recoil/5 * attacker.empowered)/3) * 5
                                    }

                                    attacker.empowered = false
                                }
                                
                                if(first){
                                    attacker.records.timesFirstAttack++
                                    stancemessages.concat(processStanceGrowth(attacker.staticData,"spd",5))
                                    first = false
                                }
                                if(action.targets.length > 1){
                                    actionCode = attacker.index + "_" + action.ability.name + "_" + action.ability.targetType
                                } else {
                                    actionCode = attacker.index + "_" + action.ability.name + "_" + action.ability.targetType + "_" + action.targets[0]
                                }   

                                if(attacker.staticData.stance == "spatk" && attacker.staticData.stances.spatk.upgrades[1] > 0){
                                    attacker.nonDamaging = 0
                                }

                                let abilityUseNotif = attacker.staticData.name + " used **" + action.ability.name + "** on "
                                let targetsHit = false

                                for(i in action.targets){
                                    if(session.session_data.fighters[action.targets[i]].alive){
                                        targetsHit = true
                                        abilityUseNotif += session.session_data.fighters[action.targets[i]].staticData.name
                                        if(i < action.targets.length - 2){
                                            abilityUseNotif += ", "
                                        } else if(i == action.targets.length - 2){
                                            abilityUseNotif += " and "
                                        }
                                    }
                                }

                                let rageBonus = 0
                                let passiveDataRage = getPassive(attacker,5)
                                if(passiveDataRage != null){
                                    rageBonus += attacker.records.timesHit * (passiveDescriptions[passiveDataRage.id].scalar.stat1[passiveDataRage.rank])
                                    if(rageBonus > 0){
                                        session.session_data.battlelog.combat.push(attacker.staticData.name + " is being empowered with rage! (x" + attacker.records.timesHit + ")")
                                    }
                                }

                                if(targetsHit){
                                    session.session_data.battlelog.combat.push(abilityUseNotif)
                                }
                                
                                let reactiveDamage = 0

                                let bonusBaseDamage = rageBonus

                                if(attacker.clearMindStacks){
                                    bonusBaseDamage += clearMindStacks
                                }

                                if(attacker.weapon){
                                    switch(action.ability.damage_type){
                                        case "atk":
                                            if(attacker.weapon.stats.baseAtkBoost)
                                                bonusBaseDamage += attacker.weapon.stats.baseAtkBoost
                                            break;

                                        case "spatk":
                                            if(attacker.weapon.stats.baseSpAtkBoost)
                                                bonusBaseDamage += attacker.weapon.stats.baseSpAtkBoost
                                            break;
                                    }
                                }

                                if(attacker.gear){
                                    switch(action.ability.damage_type){
                                        case "atk":
                                            if(attacker.gear.stats.baseAtkBoost)
                                                bonusBaseDamage += attacker.gear.stats.baseAtkBoost
                                            break;

                                        case "spatk":
                                            if(attacker.gear.stats.baseSpAtkBoost)
                                                bonusBaseDamage += attacker.gear.stats.baseSpAtkBoost
                                            break;
                                    }
                                }

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

                                        let ignoreBlock = false

                                        let passiveData = getPassive(attacker,9)
                                        if(passiveData != null){
                                            if(attacker.liveData.stats.hp <= attacker.liveData.maxhp * (passiveDescriptions[passiveData.id].scalar.stat1[passiveData.rank]/100)){
                                                ignoreBlock = true
                                                session.session_data.battlelog.combat.push(attacker.staticData.name + " is filled with rage!")
                                            }
                                        }

                                        while(attackNum > 0){
                                            console.log("test5")
                                            let attackBase = action.ability.damage_val + bonusBaseDamage
                                            let critRoll = action.ability.critical
                                            if(attacker.weapon != null && parseInt(attacker.staticData.combatStyle) == 1 && attacker.weapon.weaponStyle == 1){
                                                if(action.ability.speed > 1){
                                                    critRoll += (action.ability.speed/2) * 15
                                                }
                                            }
                                            let passiveData = getPassive(attacker,7)
                                            if(passiveData != null){
                                                critRoll += Math.floor(action.ability.recoil/10) * (passiveDescriptions[passiveData.id].scalar.stat1[passiveData.rank])
                                            }

                                            if(weaponPassives[4] > 0){
                                                if(attacker.lastAction == actionCode){
                                                    critRoll += weaponPassives[4] * 12
                                                }
                                            }

                                            let overcrit = false 

                                            if(weaponPassives[6] > 0){
                                                let speedDiff = ((attacker.liveData.stats.spd * statChangeStages[attacker.liveData.statChanges.spd])/(target.liveData.stats.spd * statChangeStages[target.liveData.statChanges.spd])) - 1
                                                if(speedDiff > 0){
                                                    critRoll += (weaponPassives[6] * 4) * (speedDiff * 10)
                                                }     
                                            }

                                            let critMax = 90
                                            let critMulti = 1;
                                            if(attacker.weapon != null && parseInt(attacker.staticData.combatStyle) == 2 && attacker.weapon.weaponStyle == 2){
                                                critMulti = 3
                                            } else {
                                                critMulti = 2
                                            }

                                            if(attacker.staticData.stance == "atk" && attacker.staticData.stances.atk.upgrades[2] > 0){
                                                let buffData = getStanceBuffValues("atk",attacker.staticData.stances,2)
                                                critMax = 100
                                                critRoll += buffData.val
                                            }

                                            if(attacker.staticData.stance == "spatk" && attacker.staticData.stances.atk.upgrades[2] > 0){
                                               critRoll -= 10
                                            }

                                            if(attacker.empowered > 0){
                                                critRoll *= 2 
                                            }

                                            if(critRoll > critMax){
                                                overcrit = true
                                                critRoll = critMax
                                            }

                                            let crit = Math.floor(Math.random() * 100) < critRoll ? critMulti : 1
                                            if(crit != 1){
                                                attackBase *= critMulti
                                            }
                                            
                                                            
                                            if(currentActionCount == actionCount){
                                                let passiveDataLast = getPassive(attacker,6)
                                                if(passiveDataLast != null){
                                                    attackBase *= (passiveDescriptions[passiveDataLast.id].scalar.stat1[passiveDataLast.rank])
                                                    session.session_data.battlelog.combat.push(attacker.staticData.name + " begins a decimating attack!")
                                                }
                                            }
                                            let accCheck = Math.floor(Math.random() * 100) 

                                            let repeatPenal = 0;
                                            if(!target.staticData.object){
                                                if(attacker.lastAction == actionCode){
                                                    attacker.repeats++
                                                    if(attacker.weapon != null && parseInt(attacker.staticData.combatStyle) == 0 && attacker.weapon.weaponStyle == 0 && action.ability.damage_type == "atk"){
                                                        repeatPenal = 2.5 * attacker.repeats
                                                    } else {
                                                        repeatPenal = 10 * attacker.repeats    
                                                    }
                                                    
                                                } else {
                                                    attacker.repeats = 0
                                                }

                                                if(target.guardData != "none" || target.guardData == "fail"){
                                                    repeatPenal = 0
                                                }
                                            }
                                           
                                            let hitConfirm = accCheck < (action.ability.accuracy - repeatPenal)
                                            if(target.staticData.stance == "def" && target.staticData.stances.hp.upgrades[2] > 0){
                                                let buffData = getStanceBuffValues("def",target.staticData.stances,2)
                                                if(Math.random * 100 < buffData.val){
                                                    hitConfirm = false
                                                }
                                            }
                                            
                                            let parry = false;
                                            if(target.weaponPassives[7] > 0){
                                                if(target.guardData == "none" && !target.hasActed){
                                                    if(Math.random() * 100 < target.weaponPassives[7] * 10){
                                                        hitConfirm = false
                                                        parry = true
                                                    }
                                                }        
                                            }
                                            if(hitConfirm){
                                                if(crit != 1){
                                                    if(!multiHit){
                                                        session.session_data.battlelog.combat.push("A critical hit!")
                                                    }
                                                    critCount++
                                                    
                                                }
                                                
                                                if(attacker.lastAction == actionCode){
                                                    attacker.records.timesAbilityRepeat++
                                                }
                                                hitCount++
                                                
                                                switch(action.ability.damage_type){
                                                    case "atk":
                                                        attacker.records.attacks++
                                                        stancemessages.concat(processStanceGrowth(attacker.staticData,"atk",3))
                                                        break;

                                                    case "spatk":
                                                        attacker.records.spattacks++
                                                        stancemessages.concat(processStanceGrowth(attacker.staticData,"spatk",3))
                                                        break;
                                                }

                                                let bonusGuardValue = 0

                                                if(target.weapon){
                                                    switch(action.ability.damage_type){
                                                        case "atk":
                                                            bonusGuardValue += target.weapon.stats.baseDefBoost
                                                            break;
                
                                                        case "spatk":
                                                            bonusGuardValue += target.weapon.stats.baseSpDefBoost
                                                            break;
                                                    }
                                                }

                                                if(target.gear){
                                                    switch(action.ability.damage_type){
                                                        case "atk":
                                                            bonusGuardValue += target.gear.stats.baseDefBoost
                                                            break;
                
                                                        case "spatk":
                                                            bonusGuardValue += target.gear.stats.baseSpDefBoost
                                                            break;
                                                    }
                                                }
                                                
                                                if(target.guardData != "none" && target.guardData != "fail" && ignoreBlock == false){
                                                    attackNum = 0
                                                    let guardValue = target.guardData.guard_val 
                                                    if(target.meter != undefined){
                                                        increaseComboMeter(target,8)
                                                    }
                                                    if(gearPassives[6] > 0){
                                                        let difference = (attacker.liveData.maxhp/target.liveData.maxhp) - 1
                                                        if(difference > 0){
                                                            if(difference > gearPassives[6] * 0.1){
                                                                difference = gearPassives[6] * 0.1
                                                            }
                                                            guardValue *= difference;
                                                        }
                                                    }

                                                    switch(target.guardData.guard_type){
                                                        case "def":
                                                            target.records.guards++
                                                            stancemessages.concat(processStanceGrowth(target.staticData,"def",3))
                                                            break;
    
                                                        case "spdef":
                                                            target.records.spguards++
                                                            stancemessages.concat(processStanceGrowth(target.staticData,"spdef",3))
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
                                                        guardValue + bonusGuardValue
                                                        attackBase -= guardValue
                                                        target.records.baseDamageBlocked += guardValue
                                                        if(attackBase <= 0){
                                                            let healAmount = 0
                                                            if(target.gearPassives[1] > 0){
                                                                if(Math.random() < target.gearPassives[1] * .15){
                                                                    let stats = ["def","spdef"]
                                                                    let choosenStat = stats[Math.floor(Math.random() * stats.length)]
                                                                    handleStatChange(session,attacker,-2,choosenStat)
                                                                }
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
                                                                    handleStatChange(session,target,1,choosenStat)
                                                                }
                                                            }
                                                        } else {
                                                            target.records.timesBlocked++
                                                            session.session_data.battlelog.combat.push(target.staticData.name + " was able to block some of the damage!")
                                                        }
                                                    } else {
                                                        let healAmount = 0 
                                                        guardValue += bonusGuardValue
                                                        attackBase -= guardValue
                                                        target.records.baseDamageBlocked += guardValue
                                                        let notice;
                                                        if(attackBase <= 0){
                                                            if(target.gearPassives[1] > 0){
                                                                if(Math.random() < target.gearPassives[1] * .15){
                                                                    let stats = ["def","spdef"]
                                                                    let choosenStat = stats[Math.floor(Math.random() * stats.length)]
                                                                    handleStatChange(session,attacker,-2,choosenStat)
                                                                }
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
                                                                    handleStatChange(session,target,1,choosenStat)
                                                                }
                                                            }
                                                        } else {
                                                            notice = target.staticData.name + " blocked some of the damage"
                                                            target.records.timesBlocked++
                                                        }
                                                        if(target.guardData.counter_val > 0){
                                                            let guard = target.guardData
                                                            let targetStatValue = getFighterStat(target,guard.counter_type)
                                                            let attackerStatValue = getFighterStat(attacker,guard.counter_type)

                                                            let counterDamage = Math.floor(calculateAttackDamage(
                                                                target.staticData.level,
                                                                targetStatValue,
                                                                attackerStatValue,
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
                                                                damageFighter(session,counterDamage,attacker)
                                                                let hpRatio = Math.floor((attacker.liveData.stats.hp / attacker.liveData.maxhp)*8)
                                                                if(attacker.staticData.lootPoint == hpRatio && !attacker.lootPointHit){
                                                                    session.session_data.battlelog.alerts.push(attacker.staticData.name + "'s loot point has been hit!")
                                                                    session.session_data.battlelog.alerts.push("---")
                                                                    attacker.lootPointHit = true
                                                                    manageCriticalPoint(session,attacker,target,"loot")
                                                                }
                                                                if(attacker.staticData.weakPoint == hpRatio && !attacker.weakPointHit){
                                                                    session.session_data.battlelog.alerts.push(attacker.staticData.name + "'s weak point has been hit!")
                                                                    session.session_data.battlelog.alerts.push("---")
                                                                    attacker.weakPointHit = true
                                                                    manageCriticalPoint(session,attacker,target,"weak")
                                                                }
                                                                attacker.records.enemyDamageTaken += counterDamage;
                                                                target.records.counterDamageDone += counterDamage
                                                                session.session_data.battlelog.combat.push(attacker.staticData.name + " took " + counterDamage + " damage")
                                                                if(attacker.liveData.stats.hp <= 0){
                                                                    attacker.staticData.lives -= 1
                                                                    if(attacker.meter != undefined){
                                                                        attacker.staticData.meterRank = 0
                                                                        attacker.meter = 0
                                                                    }
                                                                    if(attacker.staticData.lives <= 0){
                                                                        attackNum = 0
                                                                        attacker.liveData.stats.hp = 0
                                                                        attacker.alive = false
                                                                        target.records.unitsDefeated++
                                                                        attacker.attacker = -1
                                                                        attacker.choosenAbility = -2
                                                                        session.session_data.battlelog.combat.push(attacker.staticData.name + " was defeated!")
                                                                        attacker.staticData.lives = 1
                                                                        if(attacker.staticData.exploreRecord < attacker.staticData.exploreStreak){
                                                                            attacker.staticData.exploreRecord = attacker.staticData.exploreStreak
                                                                            session.session_data.battlelog.alerts.push("New Explore Streak Record!: " + attacker.staticData.exploreStreak)
                                                                        }
                                                                        attacker.staticData.exploreStreak = 0
                                                                        attacker.records.livesLost++
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
                                                                        attacker.records.livesLost++
                                                                        attacker.liveData.stats.hp = attacker.liveData.maxhp

                                                                        if(attacker.staticData.highestStat){
                                                                            attackNum = 0
                                                                            manageBossAction(attacker,session)
                                                                        }
                                                                    }

                                                                    let passiveData = getPassive(attacker,3)
                                                                    if(passiveData != null){
                                                                        let damage = attacker.liveData.maxhp * (passiveDescriptions[passiveData.id].scalar.stat1[passiveData.rank]/100)
                                                                        for(var i = 0; i < fighters.length;i++){
                                                                            if(fighters[i].index != attacker.index){
                                                                                damageFighter(session,damage,fighters[i])
                                                                                if(fighters[i].liveData.stats.hp < 1 && fighters[i].alive){
                                                                                    fighters[i].liveData.stats.hp = 1
                                                                                }
                                                                            }
                                                                        }
                                                                        session.session_data.battlelog.combat.push(attacker.staticData.name + " released a burst of energy upon losing a life, dealing " + damage + " damage to all other fighters!")
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
                                                } else {
                                                    if(attacker.meter != undefined){
                                                        increaseComboMeter(attacker,5)
                                                    }
                                                    if (weaponPassives[2] > 0 && Math.random() < 0.05 * weaponPassives[2]) {
                                                        let stats = ["atk","spatk","def","spdef","spd"]
                                                        let choosenStat = stats[Math.floor(Math.random() * stats.length)]
                                                        handleStatChange(session,attacker,1,choosenStat)
                                                    }

                                                    if (weaponPassives[8] > 0 && Math.random() < 0.08 * weaponPassives[8]) {
                                                        handleStatChange(session,target,-1,"spd")
                                                    }

                                                    if(target.gearPassives[7] > 0 && Math.random() < 0.1 * target.gearPassives[7]){
                                                        handleStatChange(session,attacker,-1,action.ability.damage_type)
                                                    }
                                                }

                                                if(attacker.alive){
                                                    let totalDamage;

                                                    if(!target.hasActed && weaponPassives[1] > 0){
                                                        attackBase += weaponPassives[1] * 4
                                                    }

                                                    let attackStatVal = getFighterStat(attacker,action.ability.damage_type)
                                                    if(attacker.staticData.stance == "spd" && attacker.staticData.stances.spd.upgrades[1] > 0){
                                                        let buffData = getStanceBuffValues("spd",attacker.staticData.stances,1)
                                                        attackStatVal += Math.ceil(getFighterStat(attacker,"spd") * (buffData.val/100))
                                                    }

                                                    let defendStat = action.ability.damage_type == "atk" ? "def" : "spdef"
                                                    let defendStatVal = getFighterStat(target,defendStat)

                                                    if(crit != 1 && weaponPassives[0] > 0){
                                                        totalDamage = calculateAttackDamage(
                                                            attacker.staticData.level,
                                                            attackStatVal,
                                                            ((100 - (weaponPassives[0] * 5))/100) * defendStatVal,
                                                            attackBase
                                                        )
                                                    } else {
                                                        totalDamage = calculateAttackDamage(
                                                            attacker.staticData.level,
                                                            attackStatVal,
                                                            defendStatVal,
                                                            attackBase
                                                        )
                                                    }

                                                    let effectiveness = 1; 
                                                    let sameType = attacker.staticData.stance == action.ability.stance && attacker.staticData.stance != "none" ? 1.25 : 1

                                                    effectiveness = stanceMatchups[action.ability.stance][target.staticData.stance]
                                                    
                                                    if((multiHit && attackNum <= 1) || !multiHit){
                                                        switch(effectiveness){
                                                            case 2:
                                                                attacker.records.effectiveAttacks++
                                                                target.records.attacksEffected++
                                                                session.session_data.battlelog.combat.push("It had a powerful impact on " + target.staticData.name + "'s stance")
                                                                break;
                                                            
                                                            case 0.5:
                                                                attacker.records.resistedAttacks++
                                                                target.records.attacksResisted++
                                                                session.session_data.battlelog.combat.push("It had a weak impact on " + target.staticData.name + "'s stance")
                                                                break;
                                                        }
                                                    }
                                                    
                                                    let finalDamage = Math.ceil(totalDamage * effectiveness * sameType)
                                                    if(weaponPassives[5] > 0){
                                                        let physCheck = target.liveData.stats.def > target.liveData.stats.spdef && action.ability.damage_type == "atk"
                                                        let specCheck = target.liveData.stats.spdef > target.liveData.stats.def && action.ability.damage_type == "spatk"
                                                        if(physCheck || specCheck){
                                                            finalDamage = Math.ceil(finalDamage * (1 + weaponPassives[5] *.05))
                                                        } 
                                                    }

                                                    if(target.staticData.stance == "hp" && target.staticData.stances.hp.upgrades[1] > 0){
                                                        let buffData = getStanceBuffValues("hp",target.staticData.stances,1)
                                                        let ratio = 1 - (target.liveData.stats.hp / target.liveData.maxhp)
                                                        let finalMulti = (buffData.val * (ratio))/100
                                                        finalDamage = Math.ceil(finalDamage * (1 - finalMulti))
                                                    }
                                                    
                                                    if(finalDamage > 0){
                                                        if(crit != 1){
                                                            attacker.records.criticalsLanded++
                                                            let passiveData = getPassive(target,4)
                                                            if(passiveData != null){
                                                                let damage = attacker.liveData.maxhp * (passiveDescriptions[passiveData.id].scalar.stat1[passiveData.rank]/100)
                                                                reactiveDamage += damage
                                                            }
                                                        }

                                                        let passiveDataGiantSlayer = getPassive(attacker,8)
                                                        if(passiveDataGiantSlayer != null){
                                                            finalDamage *= 1 + (passiveDescriptions[passiveDataGiantSlayer.id].scalar.stat1[passiveDataGiantSlayer.rank]/100) * ((target.liveData.maxhp/attacker.liveData.maxhp) - 1) * 20
                                                        }

                                                        finalDamage = Math.ceil(finalDamage)

                                                        if(target.staticData.stance == "spdef" && target.staticData.stances.spdef.upgrades[1] > 0){
                                                            let buffData = getStanceBuffValues("spdef",target.staticData.stances,1)
                                                            let resistAmount = 0
                                                            for(f of session.session_data.fighters){
                                                                if(f.team != target.team && f.alive){
                                                                    resistAmount += buffData.val
                                                                }
                                                            }
                                                            finalDamage = Math.ceil(finalDamage * (1 - resistAmount/100))
                                                        }

                                                        let hadShield = target.shieldVal > 0
                                                        finalDamage = damageFighter(session,finalDamage,target,false,true)

                                                        if(action.ability.damage_type == "atk"){
                                                            if(target.staticData.stance == "def" && target.staticData.stances.hp.upgrades[1] > 0){
                                                                let buffData = getStanceBuffValues("def",target.staticData.stances,1)
                                                                if(Math.random * 100 < buffData.val){
                                                                    handleStatChange(session,target,1,"def")
                                                                }
                                                            }
                                                        }

                                                        let hpRatio = Math.floor((target.liveData.stats.hp / target.liveData.maxhp)*8)
                                                        if(target.staticData.lootPoint == hpRatio && !target.lootPointHit){
                                                            session.session_data.battlelog.alerts.push(target.staticData.name + "'s loot point has been hit!")
                                                            session.session_data.battlelog.alerts.push("---")
                                                            target.lootPointHit = true
                                                            manageCriticalPoint(session,target,attacker,"loot")
                                                        }
                                                        if(target.staticData.weakPoint == hpRatio && !target.weakPointHit){
                                                            session.session_data.battlelog.alerts.push(target.staticData.name + "'s weak point has been hit!")
                                                            session.session_data.battlelog.alerts.push("---")
                                                            target.weakPointHit = true
                                                            manageCriticalPoint(session,target,attacker,"weak")
                                                        }
                                                        if(target.liveData.stats.hp <= target.liveData.maxhp * 0.8 && target.team != attacker.team){
                                                            target.currentTarget = attacker.discriminator
                                                        }
                                                        target.lastAttacker = attacker
                                                        target.hitThisTurn = true
                                                        target.lastDamageTakenType = action.ability.damage_type
                                                        attacker.records.attackDamageDone += finalDamage
                                                        target.records.enemyDamageTaken += finalDamage
                                                        if(multiHit){
                                                            multiDamage += finalDamage
                                                            if(attackNum <= 1 || target.liveData.stats.hp <= 0){
                                                                if(hadShield){
                                                                    if(target.shieldVal > 0){
                                                                        session.session_data.battlelog.combat.push(target.staticData.name + "'s shield absorbed damage from the hits! (" + target.shieldVal + " shield remaining)") 
                                                                    } else {
                                                                        session.session_data.battlelog.combat.push(target.staticData.name + "'s shield couldn't withstand the damage!") 
                                                                    }
                                                                }
                                                                if(finalDamage > 0){
                                                                    session.session_data.battlelog.combat.push(target.staticData.name + " took " + multiDamage + " total damage! (" + hitCount + " hits / " + critCount + " crits)")
                                                                    if(multiDamage > attacker.records.strongestStrike){
                                                                        attacker.records.strongestStrike = multiDamage
                                                                    }
                                                                    if(attacker.weapon != null && parseInt(attacker.staticData.combatStyle) == 3 && attacker.weapon.weaponStyle == 3){
                                                                        for(var i = 0; i < hitCount; i++){
                                                                            if(Math.random() <= 0.1){
                                                                                handleStatChange(session,attacker,1,action.ability.damage_type)
                                                                            }
                                                                        }
                                                                    }
                                                                }
                                                            }
                                                        } else {
                                                            if(hadShield){
                                                                if(target.shieldVal > 0){
                                                                    session.session_data.battlelog.combat.push(target.staticData.name + "'s shield absorbed the damage! (" + target.shieldVal + " shield remaining)") 
                                                                } else {
                                                                    session.session_data.battlelog.combat.push(target.staticData.name + "'s shield couldn't withstand the damage!") 
                                                                }
                                                            }
                                                            if(finalDamage > 0){
                                                                session.session_data.battlelog.combat.push(target.staticData.name + " took " + finalDamage + " damage!")
                                                                if(finalDamage > attacker.records.strongestStrike){
                                                                    attacker.records.strongestStrike = finalDamage
                                                                }
                                                                if(attacker.weapon != null && parseInt(attacker.staticData.combatStyle) == 3 && attacker.weapon.weaponStyle == 3){
                                                                    if(Math.random() <= 0.1){
                                                                        handleStatChange(session,attacker,1,action.ability.damage_type)
                                                                    }
                                                                }
                                                            }
                                                        }
                                                        triggerCombatEvent({
                                                            type:2,
                                                            data:target
                                                        },session)

                                                        
                                                        
                                                        if(action.ability.damage_type == "spatk"){
                                                            let passiveData = getPassive(target,1)
                                                            if(passiveData != null){
                                                                let damage = attacker.liveData.stats.maxhp * (passiveDescriptions[passiveData.id].scalar.stat1[passiveData.rank]/100)
                                                                reactiveDamage += damage
                                                            }
                                                        }

                                                        if(action.ability.damage_type == "atk"){
                                                            let passiveData = getPassive(target,2)
                                                            if(passiveData != null){
                                                                let damage = attacker.liveData.stats.maxhp * (passiveDescriptions[passiveData.id].scalar.stat1[passiveData.rank]/100)
                                                                reactiveDamage += damage
                                                            }
                                                        }
                                                        
                                                    }
                                                    if(target.liveData.stats.hp <= 0){
                                                        target.staticData.lives -= 1
                                                        if(target.meter != undefined){
                                                            target.staticData.meterRank = 0
                                                            target.meter = 0
                                                        }
                                                        if(target.staticData.lives <= 0){
                                                            if(attacker.staticData.stance == "spdef" && attacker.staticData.stances.spdef.upgrades[2] > 0){
                                                                let buffData = getStanceBuffValues("spdef",attacker.staticData.stances,2)
                                                                let gainedHealth = Math.ceil((buffData.val/100) * attacker.liveData.maxhp)
                                                                session.session_data.battlelog.combat.push(attacker.staticData.name + " gained " + gainedHealth + " health!")
                                                                attacker.liveData.stats.hp += gainedHealth
                                                                if(attacker.liveData.stats.hp > attacker.liveData.stats.maxhp){
                                                                    attacker.liveData.stats.hp = attacker.liveData.stats.maxhp  
                                                                }
                                                            }
                                                            attackNum = 0
                                                            target.liveData.stats.hp = 0
                                                            target.alive = false
                                                            attacker.records.unitsDefeated++
                                                            target.target = -1
                                                            target.choosenAbility = -2
                                                            session.session_data.battlelog.combat.push(target.staticData.name + " was defeated!")
                                                            target.staticData.lives = 1
                                                            if(target.staticData.exploreRecord < target.staticData.exploreStreak){
                                                                target.staticData.exploreRecord = target.staticData.exploreStreak
                                                                session.session_data.battlelog.alerts.push("New Explore Streak Record!: " + target.staticData.exploreStreak)
                                                            }
                                                            target.staticData.exploreStreak = 0
                                                            target.records.livesLost++
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
                                                            target.records.livesLost++
                                                            target.liveData.stats.hp = target.liveData.maxhp

                                                            if(target.staticData.highestStat){
                                                                attackNum = 0
                                                                manageBossAction(target,session)
                                                            }
                                                        }

                                                        let passiveData = getPassive(target,3)
                                                        if(passiveData != null){
                                                            let damage = target.liveData.maxhp * (passiveDescriptions[passiveData.id].scalar.stat1[passiveData.rank]/100)
                                                            for(var i = 0; i < fighters.length;i++){
                                                                if(fighters[i].index != target.index){
                                                                    damageFighter(session,damage,fighters[i])
                                                                    if(fighters[i].liveData.stats.hp < 1 && fighters[i].alive){
                                                                        fighters[i].liveData.stats.hp = 1
                                                                    }
                                                                }
                                                            }
                                                            session.session_data.battlelog.combat.push(target.staticData.name + " released a burst of energy upon losing a life, dealing " + damage + " damage to all other fighters!")
                                                        }
                                                    }

                                                    let recoilVal = action.ability.recoil
                                                    if(attacker.staticData.stance == "atk" && attacker.staticData.stances.atk.upgrades[2] > 0){
                                                        if(overcrit){
                                                            recoilVal += 5
                                                        } else {
                                                            recoilVal += 10
                                                        }
                                                    }
                                                    
                                                    if(attacker.staticData.stance == "spatk" && attacker.staticData.stances.spatk.upgrades[2] > 0){
                                                        let buffData = getStanceBuffValues("spatk",attacker.staticData.stances,2)
                                                        recoilVal -= buffData.val
                                                    }

                                                    if(recoilVal < 0){
                                                        recoilVal = 0
                                                    }

                                                    if(recoilVal != 0 && finalDamage > 0 && attackNum == 1){
                                                        let recoilDamage = Math.ceil(recoilVal/100 * attacker.liveData.maxhp);
                                                        session.session_data.battlelog.combat.push(attacker.staticData.name + " suffered from " + recoilDamage + " recoil damage!")
                                                        damageFighter(session,recoilDamage,attacker)
                                                        attacker.recoilDamageTaken += recoilDamage
                                                        let recoilDeath = attacker.liveData.stats.hp <= 0
                                                        if(recoilDeath){
                                                            attacker.staticData.lives -= 1
                                                            if(attacker.meter != undefined){
                                                                attacker.staticData.meterRank = 0
                                                                attacker.meter = 0
                                                            }
                                                            if(attacker.staticData.lives <= 0){
                                                                attacker.liveData.stats.hp = 0
                                                                attacker.alive = false
                                                                attacker.attacker = -1
                                                                attacker.choosenAbility = -2
                                                                session.session_data.battlelog.combat.push(attacker.staticData.name + " was defeated!")
                                                                attacker.staticData.lives = 1
                                                                if(attacker.staticData.exploreRecord < attacker.staticData.exploreStreak){
                                                                    attacker.staticData.exploreRecord = attacker.staticData.exploreStreak
                                                                    session.session_data.battlelog.alerts.push("New Explore Streak Record!: " + attacker.staticData.exploreStreak)
                                                                }
                                                                attacker.staticData.exploreStreak = 0
                                                                attacker.records.livesLost++
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
                                                                attacker.records.livesLost++
                                                                attacker.liveData.stats.hp = attacker.liveData.maxhp

                                                                if(attacker.staticData.highestStat){
                                                                    attackNum = 0
                                                                    manageBossAction(attacker,session)
                                                                }
                                                            }

                                                            let passiveData = getPassive(attacker,3)
                                                            if(passiveData != null){
                                                                let damage = attacker.liveData.maxhp * (passiveDescriptions[passiveData.id].scalar.stat1[passiveData.rank]/100)
                                                                for(var i = 0; i < fighters.length;i++){
                                                                    if(fighters[i].index != attacker.index){
                                                                        damageFighter(session,damage,fighters[i])
                                                                        if(fighters[i].liveData.stats.hp < 1 && fighters[i].alive){
                                                                            fighters[i].liveData.stats.hp = 1
                                                                        }
                                                                    }
                                                                }
                                                                session.session_data.battlelog.combat.push(attacker.staticData.name + " released a burst of energy upon losing a life, dealing " + damage + " damage to all other fighters!")
                                                            }
                                                        }
                                                    }
                                                }
                                                attackNum -= 1
                                            } else {
                                                if(hitCount > 0){
                                                    session.session_data.battlelog.combat.push(target.staticData.name + " took " + multiDamage + " total damage! (" + hitCount + " hits / " + critCount + " crits)")
                                                } else {
                                                    if(parry){
                                                        session.session_data.battlelog.combat.push(target.staticData.name + " parried!")
                                                        handleStatChange(session,target,-1,"spd")
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
                                                }
                                                attackNum = 0
                                            }
                                            attacker.target = -1
                                            attacker.choosenAbility = -1
                                        }
                                    }
                                }

                                if(reactiveDamage > 0){
                                    reactiveDamage = Math.ceil(reactiveDamage)
                                    if(attacker.alive){
                                        damageFighter(session,damage,attacker)
                                        session.session_data.battlelog.combat.push("As a result of attacking, " + attacker.staticData.name + " endured " + reactiveDamage + " damage!")
                                        if(attacker.liveData.stats.hp < 1){
                                            attacker.liveData.stats.hp = 1
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
                                    if(defender.empowered > 0){
                                        defender.records.empoweredAbilities++
                                        session.session_data.battlelog.combat.push(defender.staticData.name + " is empowered! (x" + defender.empowered + ")")
                                        action.ability.guard_val = Math.ceil(action.ability.guard_val * (1 + (defender.empowered)))
                                    
                                        action.ability.counter_val = action.ability.guard_val

                                        defender.empowered = false
                                    }
                                    actionCode = defender.index + "_" + action.ability.action_type
                                    let typeMatch = {
                                        "atk":"def",
                                        "spatk":"spdef"
                                    }
                                    if(defender.hitThisTurn && action.ability.counter_val > 0 && action.ability.guard_type == typeMatch[defender.lastDamageTakenType]){
                                        let chance = Math.floor(Math.random() * 100)
                                        let successRoll = action.ability.success_level
                                        if(gearPassives[2] > 0 && defender.lastAction == actionCode){
                                            successRoll += gearPassives[2] * 5
                                        }
                                        let successCheck = chance < successRoll
                                        if(successCheck){
                                            if(defender.meter != undefined){
                                                increaseComboMeter(defender,8)
                                            }
                                            let attacker = defender.lastAttacker
                                            let guard = clone(action.ability)

                                            let defenderStatVal = getFighterStat(defender,guard.counter_type)
                                            let attackerStatVal = getFighterStat(attacker,guard.counter_type)

                                            let counterDamage = Math.floor(calculateAttackDamage(
                                                defender.staticData.level,
                                                defenderStatVal,
                                                attackerStatVal,
                                                guard.counter_val
                                            ))

                                            if(counterDamage > 0){

                                                session.session_data.battlelog.combat.push(defender.staticData.name + " counter attacked!")
                                                if(defender.gearPassives[0] > 0){
                                                    if(Math.random() < defender.gearPassives[0] * .1){
                                                        counterDamage *= 2
                                                    }
                                                }
                                                damageFighter(session,counterDamage,attacker)
                                                let hpRatio = Math.floor((attacker.liveData.stats.hp / attacker.liveData.maxhp)*8)
                                                if(attacker.staticData.lootPoint == hpRatio && !attacker.lootPointHit){
                                                    session.session_data.battlelog.alerts.push(attacker.staticData.name + "'s loot point has been hit!")
                                                    session.session_data.battlelog.alerts.push("---")
                                                    attacker.lootPointHit = true
                                                    manageCriticalPoint(session,attacker,defender,"loot")
                                                }
                                                if(attacker.staticData.weakPoint == hpRatio && !attacker.weakPointHit){
                                                    session.session_data.battlelog.alerts.push(attacker.staticData.name + "'s weak point has been hit!")
                                                    session.session_data.battlelog.alerts.push("---")
                                                    attacker.weakPointHit = true
                                                    manageCriticalPoint(session,attacker,defender,"weak")
                                                }
                                                attacker.records.enemyDamageTaken += counterDamage;
                                                defender.records.counterDamageDone += counterDamage
                                                session.session_data.battlelog.combat.push(attacker.staticData.name + " took " + counterDamage + " damage")
                                                if(attacker.liveData.stats.hp <= 0){
                                                    attacker.staticData.lives -= 1
                                                    if(attacker.meter != undefined){
                                                        attacker.staticData.meterRank = 0
                                                        attacker.meter = 0
                                                    }
                                                    if(attacker.staticData.lives <= 0){
                                                        attackNum = 0
                                                        attacker.liveData.stats.hp = 0
                                                        attacker.alive = false
                                                        defender.records.unitsDefeated++
                                                        attacker.attacker = -1
                                                        attacker.choosenAbility = -2
                                                        session.session_data.battlelog.combat.push(attacker.staticData.name + " was defeated!")
                                                        attacker.staticData.lives = 1
                                                        if(attacker.staticData.exploreRecord < attacker.staticData.exploreStreak){
                                                            attacker.staticData.exploreRecord = attacker.staticData.exploreStreak
                                                            session.session_data.battlelog.alerts.push("New Explore Streak Record!: " + attacker.staticData.exploreStreak)
                                                        }
                                                        attacker.staticData.exploreStreak = 0
                                                        attacker.records.livesLost++
                                                        if(attacker.staticData.cpu){
                                                            processMobRewards(attacker,session)
                                                        }
                                                        triggerCombatEvent({
                                                            type:1,
                                                            data:attacker
                                                        },session)
                                                        if(attacker.staticData.rareVar){
                                                            defender.records.raresDefeated++
                                                        }
                                                    } else {
                                                        session.session_data.battlelog.combat.push(attacker.staticData.name + " lost a life! (" + attacker.staticData.lives + " remaining)")
                                                        attacker.records.livesLost++
                                                        attacker.liveData.stats.hp = attacker.liveData.maxhp

                                                        if(attacker.staticData.highestStat){
                                                            attackNum = 0
                                                            manageBossAction(attacker,session)
                                                        }
                                                    }

                                                    let passiveData = getPassive(attacker,3)
                                                    if(passiveData != null){
                                                        let damage = attacker.liveData.maxhp * (passiveDescriptions[passiveData.id].scalar.stat1[passiveData.rank]/100)
                                                        for(var i = 0; i < fighters.length;i++){
                                                            if(fighters[i].index != attacker.index){
                                                                damageFighter(session,damage,fighters[i])
                                                                if(fighters[i].liveData.stats.hp < 1 && fighters[i].alive){
                                                                    fighters[i].liveData.stats.hp = 1
                                                                }
                                                            }
                                                        }
                                                        session.session_data.battlelog.combat.push(attacker.staticData.name + " released a burst of energy upon losing a life, dealing " + damage + " damage to all other fighters!")
                                                    }
                                                }
                                            }
                                        }
                                    } 
                                    let repeatPenal = 1;
                                    if(defender.lastAction == actionCode){
                                        defender.repeats++
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
                                        if(defender.staticData.stance == "spatk" && defender.staticData.stances.spatk.upgrades[1] > 0){
                                            if(!defender.nonDamaging){
                                                defender.nonDamaging = 0
                                            }
                                            defender.nonDamaging++
                                        }

                                        if(defender.lastAction == actionCode){
                                            defender.records.timesAbilityRepeat++
                                        }
                                        if(gearPassives[8] > 0 && Math.random() < gearPassives[8] * 0.07){
                                            defender.guardData = clone(action.ability)
                                            session.session_data.battlelog.combat.push(defender.staticData.name + " used **" + action.ability.name + "** to critically defend themselves!")
                                            defender.guardData.guard_val *= 2
                                        } else {
                                            defender.guardData = clone(action.ability)
                                            session.session_data.battlelog.combat.push(defender.staticData.name + " used **" + action.ability.name + "** to defend themselves!")
                                        }
                                    } else {
                                        if(repeatPenal > 1){
                                            session.session_data.battlelog.combat.push(defender.staticData.name + " failed to prepare another block!")
                                        } else {
                                            session.session_data.battlelog.combat.push(defender.staticData.name + " failed to prepare to block!")
                                        }
                                        defender.guardData = "fail"
                                    }

                                    if(defender.guardData != "fail"){
                                        if(defender.staticData.stance == "hp" && defender.staticData.stances.hp.upgrades[2] > 0){
                                            let buffData = getStanceBuffValues("hp",defender.staticData.stances,2)
                                            let ratio = (defender.liveData.stats.hp / defender.liveData.maxhp)
                                            let finalMulti = 1 + ((buffData.val * (ratio))/100)
                                            defender.guardData.guard_val = Math.ceil(defender.guardData.guard_val * finalMulti)
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
                            if(user.alive){
                                let able = true

                                // REMOVE ON WIPE
                                if(!action.ability.focus){
                                    action.ability.focus = 75
                                }

                                if(user.hitThisTurn){
                                    able = Math.random() * 100 <= action.ability.focus
                                }

                                
                                
                                

                                if(able || user.empowered > 0){
                                    if(user.staticData.stance == "spatk" && user.staticData.stances.spatk.upgrades[1] > 0){
                                        if(!user.nonDamaging){
                                            user.nonDamaging = 0
                                        }
                                        user.nonDamaging++
                                    }
                                    if(user.alive){
                                        if(user.empowered > 0){
                                            user.records.empoweredAbilities++
                                            session.session_data.battlelog.combat.push(user.staticData.name + " is empowered! (x" + user.empowered + ")")
                                            action.ability.speed = 4
                                            for(e of action.ability.effects){
                                                e.value = Math.ceil(e.value * (1 + (user.empowered)))
                                            }
                                            
                                            user.empowered = false
                                        }
                                        if(user.meter != undefined){
                                            increaseComboMeter(user,5)
                                        }
                                        session.session_data.battlelog.combat.push(user.staticData.name + " used **" + action.ability.name + "**!")
                                        user.records.statChanges++
                                        for(effect of action.ability.effects){
                                            let targets = []
                                            switch(parseInt(effect.target)){
                                                case 0:
                                                    targets = [action.index]
                                                    break;

                                                case 1:
                                                    for(f in session.session_data.fighters){
                                                        if(session.session_data.fighters[f].team == user.team){
                                                            targets.push(f)
                                                        }
                                                    }
                                                    break;

                                                case 2:
                                                    targets = [user.target]
                                                    break;

                                                case 3:
                                                    for(f in session.session_data.fighters){
                                                        if(session.session_data.fighters[f].index != user.index){
                                                            targets.push(f)
                                                        }
                                                    }
                                                    break;

                                                case 4:
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
                                                if(!target.alive){
                                                    continue;
                                                }

                                                if(effect.value > 0){
                                                    if(user.team == target.team){
                                                        user.records.timesStatsRaised++
                                                    }
                                                } else {
                                                    if(user.team != target.team){
                                                        user.records.timesStatsLowered++
                                                    }
                                                }
                                                
                                                if(target.team != user.team && effect.value < 0){
                                                    if(weaponPassives[9] > 0 && Math.random() < 0.06 * weaponPassives[9]){
                                                        let modPrev = target.liveData.statChanges[effect.stat]
                                                        let modPost = target.liveData.statChanges[effect.stat] + effect.value
                                                        if(modPost < 0){
                                                            modPost = 0
                                                        }
                                                        let difference = Math.floor(target.liveData.stats[effect.stat] * statChangeStages[modPrev]) - (target.liveData.stats[effect.stat] * statChangeStages[modPost])
                                                        if(difference > target.maxhp * 0.05){
                                                            difference = Math.floor(target.maxhp * 0.5)
                                                        }
                                                        session.session_data.battlelog.combat.push(target.staticData.name + " sustained " + difference + " damage!")
                                                        damageFighter(session,difference,target)

                                                        if(target.liveData.stats.hp <= 0){
                                                            target.liveData.stats.hp = 1;
                                                        }
                                                    }

                                                    if(target.gearPassives[9] > 0 && Math.random() < 0.07 * target.gearPassives[9]){
                                                        target.liveData.stats.hp += Math.floor(target.liveData.maxhp * 0.05)

                                                        if(target.liveData.stats.hp > target.liveData.maxhp){
                                                            target.liveData.stats.hp = target.liveData.maxhp;
                                                        }
                                                        session.session_data.battlelog.combat.push(target.staticData.name + " healed " + Math.floor(target.liveData.maxhp * 0.05) + " health!")
                                                        
                                                    }
                                                }

                                                handleStatChange(session,target,effect.value,effect.stat)
                                            }
                                        }
                                        user.lastAction = actionCode
                                        user.target = -1
                                        user.choosenAbility = -1
                                        session.session_data.battlelog.combat.push("---")
                                    }
                                } else {
                                    session.session_data.battlelog.combat.push(user.staticData.name + " lost focus and was unable to use " + action.ability.name + "!")
                                }
                                user.lastAction = actionCode
                                user.target = -1
                                user.choosenAbility = -1
                                session.session_data.battlelog.combat.push("---")
                                break;
                            }
                    }
                    session.session_data.fighters[action.index].hasActed = true
                }
            }
            for(f of fighters){
                let passiveData = getPassive(f,0)
                let regeneratedHealth = 0 
                if(passiveData != null){
                    f.liveData.stats.hp += f.records.timesHit * passiveDescriptions[passiveData.id].scalar.stat1[passiveData.rank]
                    regeneratedHealth += f.records.timesHit * passiveDescriptions[passiveData.id].scalar.stat1[passiveData.rank]
                    if(f.liveData.stats.hp > f.liveData.maxhp){
                        f.liveData.stats.hp = f.liveData.maxhp
                    }
                }
                if(f.liveData.healing > 0){
                    f.liveData.stats.hp += Math.ceil(f.liveData.maxhp * (f.liveData.healing/100))
                    regeneratedHealth += Math.ceil(f.liveData.maxhp * (f.liveData.healing/100))
                    if(f.liveData.stats.hp > f.liveData.maxhp){
                        f.liveData.stats.hp = f.liveData.maxhp
                    }
                }
                if(regeneratedHealth > 0){
                    session.session_data.battlelog.combat.push(f.staticData.name + " regenerated " + regeneratedHealth + " health!")
                }
                delete f.lastAttacker
                f.hitThisTurn = false;
            }
            triggerCombatEvent({
                type:0
            },session)
            triggerCombatEvent({
                type:3
            },session)
            for(m of stancemessages){
                session.session_data.battlelog.alerts.push(m)
            }
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
    populateDungeonEvent(session,interaction,callback,fresh){
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
                let choicesText = ""

                for(option of session.session_data.event.options){
                    let optionStatTip;
                    if(option.value != null){
                        optionStatTip = "(" + option.value.split("|")[0].toLocaleUpperCase() + ")"
                    }
                    selectionLabels.push({
                        label: option.name,
                        description: optionStatTip,
                        value: JSON.stringify(option.value)
                    })
                    choicesText += "**" + option.name + "**\n" + option.description + "\n\n"
                }

                embed.addField(
                    "Choices",
                    choicesText
                )
                
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

                if(fresh){
                    interaction.reply({
                        content:" ",
                        embeds:[embed],
                        components:[choices]
                    })
                } else {
                    interaction.update({
                        content:" ",
                        embeds:[embed],
                        components:[choices]
                    })
                }
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
                if(totalTime <= 60){
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
                rankingText += "\n\nClear Survival (" + survivalRank + "):\nHealth: " + Math.floor((session.session_data.rankStats.currentHP/session.session_data.rankStats.startHP) * 100) + "%\nLives: " + session.session_data.rankStats.currentLives + "/" + session.session_data.rankStats.startLives 
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
                            value:1,
                            conStats:1,
                            conValue:0.25,
                            lockStatTypes: true,
                            baseVal: (10 + (session.session_data.bonus ? 5 : 0)) * session.session_data.dungeonRank,
                            types: ["weapon","gear"]
                        }
                    }
                }

                let player = session.session_data.player

                let item = generateRNGEquipment(newData)
                player = givePlayerItem(item,player)
                if(item.type == "weapon"){
                    rewardsText += player.name + " received equipment: " + item.name + " 🗡️"
                } else {
                    rewardsText += player.name + " received equipment: " + item.name + " 🛡️"
                }
                

                
                let expAmount = 0;
                let goldAmount = 0; 
                let SPAmount = 0;
                let scalarDiff = (session.session_data.dungeonRank + 1) - Math.ceil(player.level/10)  
                if(scalarDiff >= 0){
                    if(scalarDiff == 0){
                       scalarDiff = 1     
                    }       
                    let expRatio = Math.pow(scalarDiff,1.17609125906)

                    expAmount = Math.ceil((player.expCap * expRatio) * ((32 - (rankKey[speedRank] + rankKey[skillRank] + rankKey[survivalRank]))/32))
                    goldAmount = Math.ceil((400 * session.session_data.dungeonRank) * ((32 - (rankKey[speedRank] + rankKey[skillRank] + rankKey[survivalRank]))/32))
                    SPAmount = Math.ceil(10 * session.session_data.dungeonRank * ((32 - (rankKey[speedRank] + rankKey[skillRank] + rankKey[survivalRank]))/32))
                } else {
                    expAmount = 750
                    goldAmount = 150
                    SPAmount = 2 * session.session_data.dungeonRank
                }

                if(session.session_data.bonus){
                    expAmount = Math.ceil(expAmount * 1.5)
                    goldAmount = Math.ceil(goldAmount * 1.5)
                    goldAmount = Math.ceil(SPAmount * 1.5)
                }

                let result = parseReward({
                    type:"resource",
                    resource:"abilitypoints",
                    resourceName: "ability points",
                    amount: SPAmount
                }, player)
                player = result[0]

                if(result[1].length > 0){
                    for(msg of result[1]){
                        rewardsText += "\n" + msg
                    }
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

                
                
                if(session.session_data.bonus){
                    goldAmount = Math.ceil(goldAmount * 2)
                }

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

                if(!session.session_data.player.achievements){
                    session.session_data.player.achievements = {
                        kills:0,
                        abilitiesUsed:0,
                        livesLost:0,
                        strongestAttack:0,
                        tasksCompleted:0,
                        dungeonsCleared:0,
                        raidLeaderKills:0,
                        playerBattlesWon:0
                    }
                }
                session.session_data.player.achievements.dungeonsCleared++

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
        return populateCombatToQuestTransition(session)
    },
    populateAbilityCreatorWindow(session){
        const embed = new MessageEmbed()
        if(session.session_data.temp){
            let ability = session.session_data.ability
            let abilityCost = Math.ceil(calculateAbilityCost(
                session.session_data.ability,
                abilityWeights.weapon[session.session_data.weapon],
                abilityWeights.race[session.session_data.race]
            ))
            let isNeg = abilityCost <= 0
            let cost = Math.ceil(Math.pow(abilityCost,2)/450)
            let displayText = "Learn " + ability.name + " for " + cost + " ability points?\n\n"
            displayText += "__**" + ability.name + "**__\n\n"
            displayText += createAbilityDescription(ability)
            embed.addField(
                "Creating Ability: " + session.session_data.ability.name,
                displayText
            )
        } else{
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
                    "1":"All Allies",
                    "2":"One Target",
                    "3":"All",
                    "4":"All Enemies"
                }
            }

            let ability = session.session_data.ability
            let abilityCost = Math.ceil(calculateAbilityCost(
                session.session_data.ability,
                abilityWeights.weapon[session.session_data.weapon],
                abilityWeights.race[session.session_data.race]
            ))
            let isNeg = abilityCost <= 0
            let cost = Math.ceil(Math.pow(abilityCost,2)/450)
            let levelReq = Math.ceil(cost/3)
            if(levelReq > 100){
                levelReq = 100
            }
            let displayText = ""
            displayText += "Ability points to spend: " + session.session_data.abilitypoints + "\n"
            if(isNeg){
                displayText += "Ability does not have enough value\n\n"
            } else {
                displayText += "Current Ability point cost: " + cost
                if(cost <= session.session_data.abilitypoints){
                    displayText += " ✅\n\n"
                } else {
                    displayText += " ❌\n\n"
                }
                if(session.session_data.level < 100){
                    displayText += "Current Level: " + session.session_data.level + "\n"
                    displayText += "Level Requirement: " + levelReq
                    if(levelReq <= session.session_data.level){
                        displayText += " ✅\n\n"
                    } else {
                        displayText += " ❌\n\n"
                    }
                }
                // Modfiers - SCRAPPED
                // let weaponModifierText = ""
                // for(mod in abilityWeights.weapon[session.session_data.weapon][session.session_data.ability.action_type]){
                //     weaponModifierText += "\n     " + mod + ": " + (abilityWeights.weapon[session.session_data.weapon][session.session_data.ability.action_type][mod] > 0 ? "+" : "") + abilityWeights.weapon[session.session_data.weapon][session.session_data.ability.action_type][mod] * 100 + "% cost"
                // }
                // if(weaponModifierText != ""){
                //     displayText += "Character Weapon Type Modifiers:" + weaponModifierText + "\n\n"
                // }
                
                // let raceModifierText = ""
                // for(mod in abilityWeights.race[session.session_data.race][session.session_data.ability.action_type]){
                //     raceModifierText += "\n     " + mod + ": " + (abilityWeights.race[session.session_data.race][session.session_data.ability.action_type][mod] > 0 ? "+" : "") + abilityWeights.race[session.session_data.race][session.session_data.ability.action_type][mod] * 100 + "% cost"
                // }
                // if(raceModifierText != ""){
                //     displayText += "Character Race Modifiers:" + raceModifierText + "\n\n"
                // }
            }

            displayText += "__**" + ability.name + "**__\n\n"
            displayText += createAbilityDescription(ability)
            displayText += "\n\nCurrently Editing: " + session.session_data.editingAttribute

            let subAttributes = ["statchangestat","statchangevalue","statchangetarget"]
            let description;
            let attributeVal;
            if(subAttributes.includes(session.session_data.editingAttribute.split("|")[0])){
                let subatt = session.session_data.editingAttribute.split("|")[0]
                let index = session.session_data.editingAttribute.split("|")[1]
                switch(subatt){
                    case "statchangestat":
                        attributeVal = session.session_data.ability.effects[index].stat
                        description = "Stat changed by effect #" + (parseInt(index) + 1) + " of this ability"
                        break;

                    case "statchangetarget":
                        attributeVal = session.session_data.ability.effects[index].target
                        description = "Target of effect #" + (parseInt(index) + 1) + " of this ability"
                        break;

                    case "statchangevalue":
                        attributeVal = session.session_data.ability.effects[index].value
                        description = "Value stat change of effect #" + (parseInt(index) + 1)    + " of this ability"
                        break;
                }
                displayText += "\n" + description 
                displayText += "\nCurrent Value: " + 
                (
                    valueTranslate[session.session_data.editingAttribute.split("|")[0]] != undefined ? 
                    valueTranslate[session.session_data.editingAttribute.split("|")[0]][attributeVal] 
                    : 
                    attributeVal
                )
            } else {
                attributeVal = session.session_data.ability[session.session_data.editingAttribute]
                switch(session.session_data.editingAttribute){
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

                    case "guard_type":
                        description = "This changes the type of damage this guard is most effective at blocking"
                        break;

                    case "numHits":
                        description = "This value changes the number of times this ability will attack"
                        break;

                    case "targetType":
                        description = "This changes the targets that this attack has"
                        break;

                    case "recoil":
                        description = "This value changes the percentage of damage the user will take based on their maximum health"
                        break;

                    case "statChangeCount":
                        description = "This value changes the number of stats that the ability changes"
                        break;

                    case "focus":
                        description = "This value changes the ability fails if damaged before using it"
                        break;
                }
                displayText += "\n" + description 
                displayText += "\nCurrent Value: " + 
                (
                    valueTranslate[session.session_data.editingAttribute] != undefined ? 
                    valueTranslate[session.session_data.editingAttribute][attributeVal] 
                    : 
                    attributeVal
                )

                
            }
            embed.addField(
                "Creating Ability: " + session.session_data.ability.name,
                displayText
            )
        }
        return [embed]
    },
    populateStanceManagerWindow(session){
        const embed = new MessageEmbed()
        let rankNumerals = {
            "0":0,
            "1":"I",
            "2":"II",
            "3":"III",
            "4":"IV",
            "5":"V"
        }
        let stanceText = ""
        let stanceData = session.session_data.player.stances[session.session_data.viewingStance]
        stanceText += "Viewing Stance: " + stanceDict[session.session_data.viewingStance]
        stanceText += "\nTo Next Upgrade Unlock: " +  (100 - stanceData.points) + "%"
        let upgradeText = ""
        for(upgrade in stanceData.upgrades){
            let buffData = stanceBuffs[session.session_data.viewingStance][upgrade]
            let upgradeRank = session.session_data.player.stances[session.session_data.viewingStance].upgrades[upgrade]
            if(upgradeRank > 0){
                upgradeText += "\n\n**" + buffData.name + "** - Rank: " + rankNumerals[upgradeRank]
                upgradeText += "\n" + buffData.description.replace("X",buffData.val * upgradeRank) 
            }
        }
        if(upgradeText == ""){
            stanceText += "\n\nNo Upgrades Unlocked For This Stance"
        } else {
            stanceText += "\n\nUpgrades:" + upgradeText
        }
        embed.addField(session.session_data.player.name + "'s Stances",stanceText)
        return [embed]
    },
    populateStanceManagerControls(session){
        let stanceOptions = []
        for(stance in session.session_data.player.stances){
            if(session.session_data.player.stance != stance){
                stanceOptions.push({
                    label: stanceDict[stance] + " Stance",
                    description: "View " + stanceDict[stance] + " stance info",
                    value: stance,
                })
            }
        }
        const row = new MessageActionRow()
        row.addComponents(
            new MessageSelectMenu()
                .setCustomId('selectStance_' + session.session_id)
                .setPlaceholder('Select a Stance')
                .addOptions(stanceOptions),
        )
        const row2 = new MessageActionRow()
        row2.addComponents(
            new MessageButton()
                .setCustomId('cancel_' + session.session_id + "_1")
                .setLabel('Close')
                .setStyle('PRIMARY')
        )
        if(stanceOptions.length > 0){
            return [row,row2]
        } else {
            return [row2]
        }
        
    },
    populateAbilityCreatorButtons(session){
        if(session.session_data.temp){
            const row = new MessageActionRow()
            .addComponents(
                new MessageButton()
                .setCustomId('addAbility_' + session.session_id)
                .setLabel('Add Ability')
                .setStyle('PRIMARY'),

                new MessageButton()
                .setCustomId('addAbilityCancel_' + session.session_id)
                .setLabel('Cancel')
                .setStyle('DANGER')
            )
            return [row]
        } else {
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
                        description = "This changes the alignment of the attack, modifying what it's effective/less effective against"
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

                    case "guard_type":
                        description = "This changes the type of damage this guard is most effective at blocking"
                        break;
        
                    case "numHits":
                        description = "This value changes the number of times this ability will attack"
                        break;
        
                    case "targetType":
                        description = "This changes the targets that this attack has"
                        break;
        
                    case "recoil":
                        description = "This value changes the percentage of damage the user will take based on their maximum health"
                        break;

                    case "statChangeCount":
                        description = "This value changes the number of stats that the ability changes"
                        break;

                    case "focus":
                        description = "This value changes the ability fails if damaged before using it"
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

            let abilityCost = Math.ceil(calculateAbilityCost(
                session.session_data.ability,
                abilityWeights.weapon[session.session_data.weapon],
                abilityWeights.race[session.session_data.race]
            ))
            let isNeg = abilityCost <= 0
            let cost = Math.ceil(Math.pow(abilityCost,2)/450)
            let levelReq = Math.ceil(cost/3)
            if(levelReq > 100){
                levelReq = 100
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
                    .setDisabled(cost > session.session_data.abilitypoints || isNeg || session.session_data.level < levelReq),
            
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
                    "4":"Persecution"   ,
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
                    "1":"All Allies",
                    "2":"One Target",
                    "3":"All",
                    "4":"All Enemies"
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
                    AttributeValues = [0,80,5]
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
                    AttributeValues = [-4,4,1]
                    break;

                case "focus":
                    AttributeType = "upgrades"
                    AttributeValues = [60,100,5]
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
        }
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
        return populateReturnFromCombat(session,getRankingStats)
    },
    populateTownVisitWindow(session){
        const embed = new MessageEmbed()
        embed.setColor("#7289da")
        embed.setTitle(regionsEmojis[session.session_data.town.regions[1]] + regionsEmojis[session.session_data.town.regions[0]] + "" + session.session_data.town.name + "'s Town" + regionsEmojis[session.session_data.town.regions[0]] + regionsEmojis[session.session_data.town.regions[1]] + "\nLvl - " + session.session_data.town.level)
        
        let now = new Date();
        switch(session.session_data.location){
            
            case null:
                embed.addField("Choose a Destination","Where in the town would you like to visit?")
                break;

            case "records":
                let sortable = [];
                let leaderboardText = ""
                if(!session.session_data.temp){
                    session.session_data.temp = {
                        recordPage:"rep"
                    }
                }
                switch(session.session_data.temp.recordPage){
                    case "rep":
                        for (var id in session.session_data.town.reputations) {
                            sortable.push([id, session.session_data.town.reputations[id]]);
                        }
        
                        sortable.sort(function(a, b) {
                            return a[1] - b[1];
                        });
                        sortable.reverse()
                        for(entry of sortable){
                            leaderboardText += "\n<@" + entry[0]+ ">: " + entry[1]
                        }
                        embed.addField("Reputation Leaderboards:",leaderboardText)
                        break;

                    case "resource":
                        for (var id in session.session_data.town.contributors) {
                            sortable.push([id, session.session_data.town.contributors[id]]);
                        }
        
                        sortable.sort(function(a, b) {
                            return a[1] - b[1];
                        });
                        sortable.reverse()
                        for(entry of sortable){
                            leaderboardText += "\n<@" + entry[0]+ ">: " + entry[1]
                        }
                        embed.addField("Resource Leaderboards:",leaderboardText)
                        break;
                }
                
                break;

            case "tasks":
                let taskText = ""
                if(session.session_data.temp && session.session_data.temp.taskRollResults){
                    taskText += "You tried to:\n\n"
                    taskText += session.session_data.temp.taskRollResults.solutionText
                    taskText += "\n\n"
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
                    if(session.session_data.temp.taskRollResults.multi < session.session_data.temp.currentTask.multiThresh){
                        taskText += "\n" + session.session_data.temp.currentTask.suggestedSolutionPrompt + "\n"
                    }
                    taskText += "\n"
                } 
                if(session.session_data.player.taskTimer && session.session_data.player.taskTimer > now){
                    taskText += "You will be able to work on a task in " + msToTime(session.session_data.player.taskTimer - now) + "\n"
                } else {
                    taskText += "Choose a task you would like to work on from the drop down\n"
                }
                taskText += "New tasks will be available in " + msToTime(session.session_data.town.taskRestock - now) + "\n\nNote: Tasks do not factor in stats from equipment and boosters"
                embed.addField("Task Hall - Task Completion:",taskText)
                break;

            case "adventure":
                let adventureText = "From this facility you can enter your character in dungeon raids.\n\nDungeon raids are required in order for a town to increase it's level and guarantee a random piece of equipment if completed"
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
                if(session.session_data.temp && (session.session_data.temp.viewingAbilities || session.session_data.temp.selectedItem != undefined)){
                    let trainingListings = "\nYour gold: " + session.session_data.player.gold +"\n\n"
                
                    trainingListings += "Listing Resets In: " + msToTime(session.session_data.town.trainingRestock - now.getTime()) + "):\n\n**__Abilities To Teach__**"
                    for(let i in session.session_data.town.availableAbilities){
                        let ab = session.session_data.town.availableAbilities[i]
                        if(session.session_data.temp){
                            if(session.session_data.temp.selectedItem == i){
                                trainingListings += "\n\->" + ab[0].name + " - Price: " + ab[1] + " Gold"
                            } else {
                                trainingListings += "\n" + ab[0].name + " - Price: " + ab[1] + " Gold"
                            }
                        } else {
                            trainingListings += "\n" + ab[0].name + " - Price: " + ab[1] + " Gold"
                        }
                        trainingListings += "\n"
                    }

                    if(session.session_data.temp){
                        if(session.session_data.temp.resultMessage){
                            trainingListings += "\n" + session.session_data.temp.resultMessage
                        }
                    }

                    trainingListings += "\n"

                    if(session.session_data.player.abilities.length == 6){
                        trainingListings += "\nYou can not learn a new ability because you have no free ablity slot!\nManage your abilites by using `/ablities manage`"
                    }
                    embed.addField("Training Hall - Lessons and Abilities:",trainingListings)
                    if(session.session_data.temp){
                        if(session.session_data.temp.selectedItem > -1){
                            let item = session.session_data.town.availableAbilities[session.session_data.temp.selectedItem]
                            let selectedListing = "(Price: " + item[1] + "):\n```diff\n" + createAbilityDescription(item[0]) + "```"
                            embed.addField("Selected Ability: " + item[0].name,selectedListing)  
                        }
                    }
                } else {
                    let trainingMessage;
                    if(session.session_data.player.tutorial == 0){
                        trainingMessage = "From this menu, you can learn the basics of combat via combat lessons.\n\nTo continue with the tutorial, complete the first 6 combat lessons which can be accessed from the first dropdown that says 'Choose something to do'"
                        let lessons = session.session_data.player.lessons
                        if(lessons[0] && lessons[1] && lessons[2] && lessons[3] && lessons[4] && lessons[5]){
                            session.session_data.player.tutorial++
                            trainingMessage = "To continue with the tutorial, click the 'Select a facility to visit' dropdown, and select 'End Session'. Then use `/profile`"
                        }
                    } else {
                        trainingMessage = "```diff\nA cheerful person greets you as you walk into to the training hall\n\n'Welcome traveler! Here you can prepare for battle with combat lessons or learn new/upgraded abilities from a combat master! What would you like to do today?'```\nNote: For tutorial lessons, your abilities and stats will be temporarily modified"
                    }
                    embed.addField("Training Hall - Lessons and Abilities:",trainingMessage)
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
                    shopListings += "\n"
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
                        let selectedListing = printEquipmentDisplay(item[0])
                        embed.addField("Selected Item: (Price: " + item[1] + "):",selectedListing,true)
                        if(session.session_data.player.inventory){
                            let yourListing = null
                            if(item[0].type == "weapon" && session.session_data.player.weapon != undefined){
                                yourListing = printEquipmentDisplay(session.session_data.player.inventory[session.session_data.player.weapon])
                            }
                            if(item[0].type == "gear" && session.session_data.player.gear != undefined){
                                yourListing = printEquipmentDisplay(session.session_data.player.inventory[session.session_data.player.gear])
                            }   
                            if(yourListing != null){
                                embed.addField("Your current " + item[0].type + ":",yourListing,true)
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
                
                if(p.tutorial == 6){
                    content = "At this facility you can buy meals that will temporarily boost your stats, as well as slices of cake that will increase your life total.\n\nSince you only have one right now, buy 2 slices of cake so that your life total can be equal to 3"
                } else if(p.tutorial == 7){
                    content = "Come here again some time once you've earned more gold.\n\nYou can also spend gold at the market.\nCheck it out by using the second drop down and selecting 'Market'"
                }

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
                                    content += "\n" + capitalize(boost.type) + ": " + boost.value + "% (" + msToTime(Math.abs(now.getTime() - boost.expire)) +  " remaining)"
                                    break;

                                default:
                                    content += "\n" + capitalize(boost.type) + ": +" + boost.value + " Stage" + (boost.value > 1 ? "s" : "") + " (" + msToTime(Math.abs(now.getTime() - boost.expire)) +  " remaining)"
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
                content += "\n\nLives remaining: " + p.lives
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
                nextBuild += "\nCurrent Level Dungeon Cleared (Level " + town.level + "): " + (town.dungeonClear ? "✅ Complete" : "❌ Incomplete")
                nextBuild += "\n- Dungeons can be accessed from the Adventurer's Hall"
                nextBuild += "\n\nResources Maxed: " + (resourceCheck ? "✅ Complete" : "❌ Incomplete") 
                nextBuild += "\n- Resources are earned from activity in a discord server, moreso from members who have started playing Freedom RPG. Certain resources can be prioritized by selecting a job using the dropdown below"
                nextBuild += "\n\nPoint Threshold Reached (" + town.points + "/" + town.level * 30 + "): " + (town.points >= town.level * 30 ? "✅ Complete" : "❌ Incomplete") 
                nextBuild += "\n- Town points can be earned by completing missions listed in the Militia Hall"

                embed.addField("Meeting Hall - Town Status:",
                    "🪵(Wood): " + town.resources.wood[0] + "/" + town.resources.wood[1] +
                    "\n🥩(Food): " + town.resources.food[0] + "/" + town.resources.food[1] +
                    "\n💎(Minerals): " + town.resources.minerals[0] + "/" + town.resources.minerals[1]+
                    "\n\nTown Points: " + town.points +
                    "\n\nTotal resources you have contributed: " +  (!town.contributors[session.session_data.player.id] ? 0 : town.contributors[session.session_data.player.id])  + 
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
                report +="\n\nCurrent town points: " + session.session_data.town.points + "\n\n"
                let missionsComplete = true;
                let missionText = ""
                for(var i = 0;i < 3; i++){
                    missionText += "**" + rankIndexer[i] + " Missions (" + pointIndexer[i] +" town points):**\n"
                    for(mission of raidData.missions[i]){
                        missionText += missions[i][mission.type]
                        if(mission.completers){
                            let count = 0
                            for(player in mission.completers){
                                count += mission.completers[player].times
                            }
                            if(count > 0){
                                missionText += " - ✅ Completed " + count + " times"
                            } else {
                                missionText += " - ❌ Incomplete"
                                missionsComplete = false
                            }
                            if(mission.completers[session.session_data.player.id]){
                                let progress = mission.completers[session.session_data.player.id]
                                if(progress.progression[0] >= 1 && progress.progression[1] > 1){
                                    missionText += "\nYou progression towards completion: " + progress.progression[0] + "/" + progress.progression[1] + "\n"
                                }
                            } else {
                                missionText += "\n"
                            }
                        } else {
                            missionText += " - ❌ Incomplete"
                            missionsComplete = false
                        }
                        missionText += "\n"
                    }
                    missionText += "\n"
                }
                if(missionsComplete){
                    missionText += "**Retaliation Mission Avaliable (15 town points on personal first clear, 4 otherwise) - Confront Raid Leader**"
                    if(raidData.bossDefeats){
                        let count = 0
                        for(player in raidData.bossDefeats){
                            count += raidData.bossDefeats[player].times
                        }
                        if(count > 0){
                            missionText += " - ✅ Completed " + count + " times"
                        } else {
                            missionText += " - ❌ Incomplete"
                        }   
                    } else {
                        missionText += " - ❌ Incomplete"
                    }
                } else {
                    missionText += "**Retaliation Mission Unavaliable** - *All other missions must be completed at least once to unlock*"
                }
                embed.addField("Militia Hall - Raid Defense Effort:",report)
                embed.addField("Militia Hall - Raid Missions:",missionText)
                break;
                
            case "armory":
                let armoryText = ""
                if(session.session_data.temp){
                    let shopListings = ""
                    let townLevel = session.session_data.town.level
                    switch(session.session_data.temp.upgradeType){
                        case "0":
                            shopListings = "Availiable Ability Upgrades (Listing Resets In: " + msToTime(session.session_data.town.marketRestock - now.getTime()) + "):\n"
                            if(session.session_data.temp.abilitySelection){
                                let ability = session.session_data.player.abilities[session.session_data.temp.abilitySelection]
                            
                                let termDict = {
                                    "attack":"Attack",
                                    "guard":"Guard",
                                    "stats":"Stat"
                                }
                                shopListings += "\n" + termDict[ability.action_type] + " Upgrades:"
                                for(i in session.session_data.town.armorylistings.ability){
                                    let upgrade = session.session_data.town.armorylistings.ability[i]
                                    if(upgrade.type == ability.action_type){
                                        shopListings += "\n"
                                        if(session.session_data.temp){
                                            if(session.session_data.temp.upgradeOption == i){
                                                shopListings += "\->"
                                            } 
                                        }
                                        shopListings += "**Option #" + (parseInt(i)+1)
                                        let postAbility = clone(ability)
                                        let prevCost = Math.ceil(Math.pow(calculateAbilityCost(ability),2)/450)
                                        let valueSets;
                                        switch(ability.action_type){
                                            case "attack":
                                                valueSets = {
                                                    "critical":[[0,80,5],"inc"],
                                                    "damage_val":[[10,100,5],"inc"],
                                                    "numHits":[[1,5,1],"inc"],
                                                    "recoil":[[0,100,5],"inc",-1],
                                                    "accuracy":[[60,130,10],"inc"],
                                                    "speed":[[0,1,2,4],"val"]
                                                }
                                                break;
                
                                            case "guard":
                                                valueSets = {
                                                    "guard_val":[[10,200,5],"inc"],
                                                    "counter_val":[[0,200,5],"inc"],
                                                    "success_level":[[100,200,400],"val"]
                                                }
                                                break;
                
                                            case "stats":
                                                valueSets = {
                                                    "speed":[[0,1,2,4],"val"],
                                                    "focus":[[60,100,5],"inc"]
                                                }
                                                break;
                                        }
                                        let upgradeValues = valueSets[upgrade.stat]
                                        switch(upgradeValues[1]){
                                            case "inc":
                                                if(upgradeValues[2] == -1){
                                                    postAbility[upgrade.stat] -= upgradeValues[0][2]
                                                } else {
                                                    postAbility[upgrade.stat] += upgradeValues[0][2]
                                                }
                                                break;
                
                                            case "val":
                                                let index = upgradeValues[0].indexOf(parseInt(ability[upgrade.stat]))
                                                if(upgradeValues[2] == -1){
                                                    postAbility[upgrade.stat] = upgradeValues[0][index - 1]
                                                } else {
                                                    postAbility[upgrade.stat] = upgradeValues[0][index + 1]
                                                }
                                                break
                                        }
                                        let postCost = Math.ceil(Math.pow(calculateAbilityCost(postAbility),2)/450)
                                        let upgradeCost = (postCost - prevCost) * 100
                                        shopListings += " (Costs " + upgradeCost + " gold):**"
                                        shopListings += "\nImprove " + upgrade.stat + "\n"
                                    }
                                }
                                
                            } else {
                                shopListings += "\nSelect an ability to view availible upgrades\n"
                            }
                            break;

                        case "1":
                            shopListings = "Availiable Equipment Upgrades (Listing Resets In: " + msToTime(session.session_data.town.marketRestock - now.getTime()) + "):\n"
                            let upgradeTypeDict = {
                                "hp":"HP",
                                "atk":"ATK",
                                "def":"DEF",
                                "spatk":"SPATK",
                                "spdef":"SPDEF",
                                "spd":"SPD",
                                "baseAtk":"ATK Ability Base Damage",
                                "baseSpAtk":"SPATK Ability Base Damage",
                                "baseDef":"Passive DEF Guard Value",
                                "baseSpDef":"Passive SPDEF Guard Value",
                            }

                            for(i in session.session_data.town.armorylistings.equipment){
                                let upgrade = session.session_data.town.armorylistings.equipment[i]
                                let upgradeCost;
                                if(upgrade.pow){
                                    upgradeCost = Math.ceil(Math.pow(upgrade.multi,upgrade.roll) * townLevel * 500)
                                } else {
                                    upgradeCost = Math.ceil(upgrade.multi * upgrade.roll * townLevel * 50)
                                }

                                let equipmentType = ""
                                if(session.session_data.temp.equipmentSelection){
                                    switch(session.session_data.temp.equipmentSelection){
                                        case "0":
                                            equipmentType = "gear"
                                            break;
                
                                        case "1":
                                            equipmentType = "weapon"
                                            break;
                                    }
                                
                                    if(session.session_data.player.inventory[session.session_data.player[equipmentType]].upgrades){
                                        upgradeCost *= session.session_data.player.inventory[session.session_data.player[equipmentType]].upgrades
                                    }
                                }
                                let upgradeValue = Math.ceil(townLevel * upgrade.multi) * upgrade.roll
                                    shopListings += "\n"
                                    if(session.session_data.temp){
                                        if(session.session_data.temp.upgradeOption == i){
                                            shopListings += "\->"
                                        } 
                                    }
                                    shopListings += "**Option #" + (parseInt(i)+1) + "**: "
                                shopListings += "\n +" + upgradeValue + " " + upgradeTypeDict[upgrade.stat] + " - Price: " + upgradeCost + " Gold\n"
                            }
                            break;
                    }
                    armoryText += shopListings
                    if(session.session_data.temp.result){
                        armoryText += "\n" + session.session_data.temp.result + "\n"
                    }
                    armoryText += "\nYour Gold: " + session.session_data.player.gold
                } else {
                    armoryText = "Select the type of upgrades you would like to view"
                }
                embed.addField("Armory - Upgrade Hub:",armoryText)
                break;
            }
        return [embed]
    },
    populateTownVisitControls(session){
        let now = new Date()
        let selectionLabels = []

        selectionLabels.push({
            label: "End Session",
            description: "Finish your visit to this server's town",
            value: "end",
        })

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
        

        const travel = new MessageActionRow()
        .addComponents(
            new MessageSelectMenu()
                .setCustomId('townVisit_' + session.session_id)
                .setPlaceholder('Select a facility to visit')
                .addOptions(selectionLabels),
                
        );
        const help = new MessageActionRow()
        .addComponents(
            new MessageButton()
                .setCustomId('help_NULL_' + session.session_data.location)
                .setLabel('Info')
                .setStyle('PRIMARY')
        );
        switch(session.session_data.location){
            case null:
                return [travel]

            case "armory":
                let typeList = [
                    {
                        label: "Abiltiy Upgrades",
                        description: "View upgrades availiable for your abilities",
                        value: "0"
                    },
                    {
                        label: "Equipment Upgrades",
                        description: "View upgrades availiable for your equipment",
                        value: "1"
                    }
                ]

                let typePlaceholder = 'Armory Upgrades'
                let upgradeType;
                if(session.session_data.temp){
                    switch(session.session_data.temp.upgradeType){
                        case "0":
                            upgradeType = "Ability"
                            typePlaceholder = "Abiltiy Upgrades"
                            break;

                        case "1":
                            upgradeType = "Equipment"
                            typePlaceholder = "Equipment Upgrades"
                            break;
                    }
                }
                const upgradeTypes = new MessageActionRow()
                .addComponents(
                    new MessageSelectMenu()
                    .setCustomId('selectArmoryType_' + session.session_id)
                    .setPlaceholder(typePlaceholder)
                    .addOptions(typeList)
                )
                if(session.session_data.temp){

                    const upgradeButtons = new MessageActionRow()
                    .addComponents(
                        new MessageButton()
                            .setCustomId('applyUpgrades_' + session.session_id)
                            .setLabel('Apply Upgrades')
                            .setStyle('SUCCESS'),
                        new MessageButton()
                            .setCustomId('previewSelected' + upgradeType + '_' + session.session_id)
                            .setLabel('Show Selected ' + upgradeType)
                            .setStyle('PRIMARY')
                    );
                
                    let optionLabels = []
                    let townLevel = session.session_data.town.level
                    const upgradeOptions = new MessageActionRow()
                    const targetSelection = new MessageActionRow()
                    switch(session.session_data.temp.upgradeType){
                        case "0":
                            if(session.session_data.temp.abilitySelection){
                                for(i in session.session_data.town.armorylistings.ability){
                                    let upgrade = session.session_data.town.armorylistings.ability[i]
                                    let ability = session.session_data.player.abilities[session.session_data.temp.abilitySelection]
                                    if(upgrade.type == ability.action_type){
                                        let postAbility = clone(ability)
                                        let prevCost = Math.ceil(Math.pow(calculateAbilityCost(ability),2)/450)
                                        let valueSets;
                                        switch(ability.action_type){
                                            case "attack":
                                                valueSets = {
                                                    "critical":[[0,80,5],"inc"],
                                                    "damage_val":[[10,100,5],"inc"],
                                                    "numHits":[[1,5,1],"inc"],
                                                    "recoil":[[0,100,5],"inc",-1],
                                                    "accuracy":[[60,130,10],"inc"],
                                                    "speed":[[0,1,2,4],"val"]
                                                }
                                                break;

                                            case "guard":
                                                valueSets = {
                                                    "guard_val":[[10,200,5],"inc"],
                                                    "counter_val":[[0,200,5],"inc"],
                                                    "success_level":[[100,200,400],"val"]
                                                }
                                                break;

                                            case "stats":
                                                valueSets = {
                                                    "speed":[[0,1,2,4],"val"],
                                                    "focus":[[60,100,5],"inc"]
                                                }
                                                break;
                                        }
                                        let upgradeValues = valueSets[upgrade.stat]
                                        let maxed = false
                                        switch(upgradeValues[1]){
                                            case "inc":
                                                if(upgradeValues[2] == -1){
                                                    if(ability[upgrade.stat] > upgradeValues[0][0]){
                                                        postAbility[upgrade.stat] -= upgradeValues[0][2]
                                                    } else {
                                                        maxed = true
                                                    }
                                                } else {
                                                    if(ability[upgrade.stat] < upgradeValues[0][1]){
                                                        postAbility[upgrade.stat] += upgradeValues[0][2]
                                                    } else {
                                                        maxed = true
                                                    }
                                                }
                                                break;

                                            case "val":
                                                let index = upgradeValues[0].indexOf(parseInt(ability[upgrade.stat]))
                                                if(upgradeValues[2] == -1){
                                                    if(index > 0){
                                                        postAbility[upgrade.stat] = upgradeValues[0][index - 1]
                                                    } else {
                                                        maxed = true
                                                    }
                                                } else {
                                                    if(index < upgradeValues[0].length - 1){
                                                        postAbility[upgrade.stat] = upgradeValues[0][index + 1]
                                                    } else {
                                                        maxed = true
                                                    }
                                                }
                                                break
                                        }
                                        let postCost = Math.ceil(Math.pow(calculateAbilityCost(postAbility),2)/450)
                                        let upgradeCost = (postCost - prevCost) * 100
                                        if(!maxed){
                                            optionLabels.push({
                                                label:"Option #" + (parseInt(i) + 1),
                                                description:"Improve " + upgrade.stat + ": (" + ability[upgrade.stat] + " -> " + postAbility[upgrade.stat] + ") - Price: " + upgradeCost + " Gold",
                                                value:i
                                            })
                                        }
                                    }
                                }

                                if(session.session_data.temp.abilitySelection){
                                    let optionText = 'Select Option'
                                    if(session.session_data.temp.upgradeOption){
                                        optionText = optionLabels[session.session_data.temp.upgradeOption].label;
                                    }
                                    

                                    upgradeOptions.addComponents(
                                        new MessageSelectMenu()
                                        .setCustomId('selectUpgradeOption_' + session.session_id)
                                        .setPlaceholder(optionText)
                                        .addOptions(optionLabels)
                                    )
                                }
                            }

                            let currentAbilitySelection = 'Select Ability To Upgrade'
                            if(session.session_data.temp.abilitySelection){
                                currentAbilitySelection = "Upgrade " + session.session_data.player.abilities[session.session_data.temp.abilitySelection].name
                            }

                            let abilityList = []
                            for(var i in session.session_data.player.abilities){
                                let a = session.session_data.player.abilities[i]
                                abilityList.push({
                                    label:"Select " + a.name,
                                    description:"Select " + a.name + " to be upgraded",
                                    value:i
                                })
                            }

                            targetSelection.addComponents(
                                new MessageSelectMenu()
                                .setCustomId('selectUpgradeAbility_' + session.session_id)
                                .setPlaceholder(currentAbilitySelection)
                                .addOptions(abilityList)
                            )
                            break;

                        case "1":
                            let upgradeTypeDict = {
                                "hp":"HP",
                                "atk":"ATK",
                                "def":"DEF",
                                "spatk":"SPATK",
                                "spdef":"SPDEF",
                                "spd":"SPD",
                                "baseAtk":"ATK Ability Base Damage",
                                "baseSpAtk":"SPATK Ability Base Damage",
                                "baseDef":"Passive DEF Guard Value",
                                "baseSpDef":"Passive SPDEF Guard Value",
                            }

                            for(i in session.session_data.town.armorylistings.equipment){
                                let upgrade = session.session_data.town.armorylistings.equipment[i]
                                let upgradeCost;
                                if(upgrade.pow){
                                    upgradeCost = Math.ceil(Math.pow(upgrade.multi,upgrade.roll) * townLevel * 500)
                                } else {
                                    upgradeCost = Math.ceil(upgrade.multi * upgrade.roll * townLevel * 50)
                                }
                                let upgradeValue = Math.ceil(townLevel * upgrade.multi) * upgrade.roll
                                optionLabels.push({
                                    label:"Option #" + (parseInt(i) + 1),
                                    description:"+" + upgradeValue + " " + upgradeTypeDict[upgrade.stat] + " - Price: " + upgradeCost + " Gold",
                                    value:i
                                })
                            }

                            let optionText = 'Select Option'
                            if(session.session_data.temp.upgradeOption){
                                optionText = optionLabels[session.session_data.temp.upgradeOption].label;
                            }
                            
        
                            upgradeOptions.addComponents(
                                new MessageSelectMenu()
                                .setCustomId('selectUpgradeOption_' + session.session_id)
                                .setPlaceholder(optionText)
                                .addOptions(optionLabels)
                            )

                            let equipmentList = [
                                {
                                    label: "Upgrade Equipped Armor",
                                    description: "Apply upgrades to currently equipped armor",
                                    value: "0"
                                },
                                {
                                    label: "Upgrade Equipped Weapon",
                                    description: "Apply upgrades to currently equipped weapon",
                                    value: "1"
                                }
                            ]
                            
                            let currentEquipmentSelection = 'Select Equipment To Upgrade'
                            if(session.session_data.temp.equipmentSelection){
                                switch(session.session_data.temp.equipmentSelection){
                                    case "0":
                                        currentEquipmentSelection = "Upgrade Equipped Armor"
                                        break;
        
                                    case "1":
                                        currentEquipmentSelection = "Upgrade Equipped Weapon"
                                        break;
                                }
                                
                            }
        
                            targetSelection.addComponents(
                                new MessageSelectMenu()
                                .setCustomId('selectUpgradeEquipment_' + session.session_id)
                                .setPlaceholder(currentEquipmentSelection)
                                .addOptions(equipmentList)
                            )
                            break;
                    }

                    if(upgradeOptions.components.length > 0){
                        return [upgradeTypes,upgradeButtons,upgradeOptions,targetSelection,travel]
                    } else {
                        return [upgradeTypes,upgradeButtons,targetSelection,travel]
                    }
                } else {
                    return [upgradeTypes,travel]
                }

                

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
                    return [help,taskList,travel]
                } else {
                    return [help,travel]
                }
                break;

            case "adventure":
                let adventureChoice = new MessageActionRow()
                    .addComponents(
                        new MessageButton()
                        .setCustomId('promptDungeon_' + session.session_id)
                        .setLabel("Dungeon Adventure")
                        .setStyle('PRIMARY')
                    )
                return [help,adventureChoice,travel]
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
                    return [help,hallChoice,travel]
                } else {
                    hallChoice = new MessageActionRow()
                    .addComponents(
                        new MessageButton()
                        .setCustomId('hallAttempt_' + session.session_id)
                        .setLabel("Claim Battle Hall From " + session.session_data.town.hallOwner.name)
                        .setStyle('PRIMARY') 
                    )
                    return [help,hallChoice,travel]
                }
                break;

            case "training":
                if(session.session_data.temp && (session.session_data.temp.viewingAbilities || session.session_data.temp.selectedItem != undefined)){
                    let abilityOptions = [{
                        label: "Return to training options",
                        description:"View training lessons",
                        value: "practiceLessons",
                    }]

                    
                    for(a in session.session_data.town.availableAbilities){
                        let ability = session.session_data.town.availableAbilities[a]
                        abilityOptions.push({
                            label:ability[0].name,
                            description:"View " + ability[0].name + " (" + ability[1] + " Gold)",
                            value:a
                        })
                    }
    
                    const trainingChoice = new MessageActionRow()
                    .addComponents(
                        new MessageSelectMenu()
                            .setCustomId('selectListing_' + session.session_id)
                            .setPlaceholder('What would you like to do')
                            .addOptions(abilityOptions),                 
                    );
    
                    if(session.session_data.temp){
                        if(session.session_data.temp.selectedItem > -1){
                            if(session.session_data.player.abilities.length < 6){
                                const purchaseOption = new MessageActionRow()
                                .addComponents(
                                    new MessageButton()
                                    .setCustomId('learnTrainingAbility_' + session.session_id)
                                    .setLabel("Learn " + session.session_data.town.availableAbilities[session.session_data.temp.selectedItem][0].name + " For " + session.session_data.town.availableAbilities[session.session_data.temp.selectedItem][1] + " Gold")
                                    .setStyle('SUCCESS')
                                    .setDisabled(session.session_data.player.gold < session.session_data.town.availableAbilities[session.session_data.temp.selectedItem][1])
                                )
                                return [help,purchaseOption,trainingChoice,travel]
                            }
                        } else {
                            return [help,trainingChoice,travel]
                        }
                    } else {
                        return [help,trainingChoice,travel]
                    }
                
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
                
                    const trainingChoice = new MessageActionRow()
                    .addComponents(
                        new MessageSelectMenu()
                            .setCustomId('trainingOption_' + session.session_id)
                            .setPlaceholder('Choose something to do')
                            .addOptions(trainingOptions),                 
                    );
                    return [help,trainingChoice,travel]
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
                        return [help,purchaseOptions,marketListings,travel]
                    } else {
                        return [help,marketListings,travel]
                    }
                } else {
                    return [help,marketListings,travel]
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
                return [help,jobChoice,travel]

            case "defense":
                let challengingMissions = ["Defend The Town Walls From Onslaught","Distract A Large Enemy","Siege An Enemy Rally Point"]
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
                return [help,missions,travel]

            case "tavern":
                let menu = clone(tavernOptions)
                
                let lifeDifference = 3 - session.session_data.player.lives
                for(var i = lifeDifference;i > 0; i--){
                    let pluralCheck = i > 1 ? "Slices" : "Slice"
                    menu.push({
                        label: i + " " + pluralCheck + " of cake",
                        description: "Increase Lives by " + i + " - " + (1000 * i) + " gold",
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
                return [help,orders,travel]
                break;

            case "records":
                let leaderboardPages = [{
                    label: "Town Reputation",
                    description: "View town reputation leaderboard",
                    value: "rep"
                },{
                    label: "Town Resource Contribution",
                    description: "View town resource leaderboard",
                    value: "resource"
                }]

                const pages = new MessageActionRow()
                .addComponents(
                    new MessageSelectMenu()
                    .setCustomId('recordPage_' + session.session_id)
                    .setPlaceholder('Select leaderboard to view')
                    .addOptions(leaderboardPages),
                )
                return [pages,travel]
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
        if(session.session_data.inventory.length > 0){
            select.addComponents(
                new MessageSelectMenu()
                    .setCustomId('selectInventory_' + session.session_id)
                    .setPlaceholder('Select an item to view')
                    .addOptions(selectionLabels),
                    
            );
        } else {
            select.addComponents(
                new MessageButton()
                .setCustomId('fake_' + session.session_id + "_0")
                .setLabel('Inventory Empty')
                .setStyle('DANGER')
                .setDisabled(true),
            )
        }   
        

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
            .setStyle('SUCCESS'),

            new MessageButton()
            .setCustomId('cancelInventory_' + session.session_id)
            .setLabel('Cancel Inventory')
            .setStyle('DANGER')
        )
        if(session.session_data.selected == null){
            const sellAll = new MessageActionRow().addComponents(
                new MessageButton()
                .setCustomId('sellAll_' + session.session_id)
                .setLabel('Sell All Non-Favorited')
                .setStyle('DANGER')
            )
            return [select,sellAll,pages]
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
            const itemActions2 = new MessageActionRow()
            itemActions2.addComponents(
                new MessageButton()
                .setCustomId('favoriteItem_' + session.session_id)
                .setLabel(session.session_data.inventory[session.session_data.selected].favorite? 'Unfavorite Item' : 'Favorite Item')
                .setStyle(session.session_data.inventory[session.session_data.selected].favorite? 'DANGER' : 'PRIMARY')
            )
            itemActions2.addComponents(
                new MessageButton()
                .setCustomId('sellItem_' + session.session_id)
                .setLabel('Sell Item')
                .setStyle('DANGER')
            )
            return [select,pages,itemActions,itemActions2]
        }
        
        
    },
    populateInventoryWindow(session){
        const embed = new MessageEmbed()
        embed.setColor("#7289da")
        embed.setTitle(session.session_data.player.name + "'s Inventory")
        if(session.session_data.sellReward.gold != 0){
            embed.addField(
                "Selling Rewards:",
                "Gold: " + session.session_data.sellReward.gold + "\nReputation: " + session.session_data.sellReward.rep
            )
        }
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
                if(item.favorite){
                    items += "⭐"
                }
                if(item.type == "gear" && parseInt(session.session_data.player.gear) == i){
                    items += " (E)"
                }
                if(item.type == "weapon" && parseInt(session.session_data.player.weapon) == i){
                    items += " (E)"
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
            let data = printEquipmentDisplay(item)
            embed.addField("Selected Item",data,true)
            if(session.session_data.player[item.type] >= 0 && session.session_data.player[item.type] != null && session.session_data.player[item.type] != session.session_data.selected){
                data = printEquipmentDisplay(session.session_data.inventory[session.session_data.player[item.type]])
                embed.addField("Equipped",data,true)
            }
            return [embed]
        }
    },
    populateTaskWindow(session){
        const embed = new MessageEmbed()
        embed.setColor("#7289da")
        embed.setTitle(session.session_data.temp.currentTask.name)
        embed.addField("Task Details",session.session_data.temp.currentTask.description)
        let promptText = ""
        promptText += session.session_data.temp.currentTask.taskPrompt + "\n\n"
        for(s in session.session_data.temp.currentTask.solutionMap){
            let statSol = session.session_data.temp.currentTask.solutionMap[s]
            promptText += "**" + statSol.solution + "**\n" + statSol.solutionDesc + "\n\n"
        }
        embed.addField("Task Prompt",promptText)
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
                description: "(" + s.toLocaleUpperCase() + ")",
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

            case "duelRequest":
                embed.setColor("#7289da")
                embed.setTitle("⚔️ " + session.session_data.lifeCount + "❤️ - Duel Challenge ⚔️")
                message = "<@" + session.user_ids[0] + "> has challenged you to a duel!"
                message += "\n\n**Combat Tips**"
                message += "\n\n- When a duelist runs out of health, they will lose 1 ❤️"
                message += "\n\n- If you have ❤️s left after losing your health, you will heal to full"
                message += "\n\n- Once you run out of ❤️s, you lose the battle"
                message += "\n\n- Repeating attacks makes them less likely to land"
                message += "\n\n- Repeated guards have a increased chance of failing"
                message += "\n\n- During combat, click 'My FIghter' to learn more about your abilities"
                embed.addField(" - - - ",message)
                return[embed]
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
        
            case "duelRequest":
                actions.addComponents(
                    new MessageButton()
                    .setCustomId('duelResponse_' + session.session_id + "_0")
                    .setLabel('Accept')
                    .setStyle('SUCCESS')
                )
        
                actions.addComponents(
                    new MessageButton()
                    .setCustomId('duelResponse_' + session.session_id + "_1")
                    .setLabel('Decline')
                    .setStyle('DANGER')
                )
                return [actions]
        }
    },
    populateManageAbilityControls(session){
        let actions = new MessageActionRow()
        let actions2 = new MessageActionRow()
        let actions3 = new MessageActionRow()
        let actions4 = new MessageActionRow()
        if(!session.session_data.noEdit){
            actions.addComponents(
                new MessageButton()
                .setCustomId('closeAbilityManage_' + session.session_id)
                .setLabel('Close Window')
                .setStyle('DANGER')
            )
        }

        let removeAbilityList = []
        let selectAbilityList = []
        for(let i = 0; i < session.session_data.player.abilities.length; i++){
            let ability = session.session_data.player.abilities[i]
           
            if(!session.session_data.noEdit){
                removeAbilityList.push({
                    label: ability.name,
                    description: "Remove " + ability.name,
                    value: i.toString(),
                })
            }

            selectAbilityList.push({
                label: ability.name,
                description: "Select " + ability.name,
                value: i.toString(),
            })
        }

        actions2.addComponents(
            new MessageSelectMenu()
                .setCustomId('viewAbility_' + session.session_id)
                .setPlaceholder('Select an ability to view')
                .addOptions(selectAbilityList),
                
        );

        if(!session.session_data.noEdit){
            if(session.session_data.temp && session.session_data.temp.selected != undefined){
                let cost = calculateAbilityCost(session.session_data.player.abilities[session.session_data.temp.selected])
                let pointReturn = Math.ceil(Math.ceil(Math.pow(cost,2)/450)/10)
                actions.addComponents(
                    new MessageButton()
                    .setCustomId('refundAbility_' + session.session_id)
                    .setLabel('Refund Selected Ability (' + pointReturn + " ability points)")
                    .setStyle('DANGER')
                )
            }

            actions3.addComponents(
                new MessageSelectMenu()
                    .setCustomId('removeAbility_' + session.session_id)
                    .setPlaceholder('Select an ability to remove')
                    .addOptions(removeAbilityList),
                    
            );

            if(session.session_data.player.abilityMemory && session.session_data.player.abilityMemory.length > 0){
                let memoryList = []

                for(let i = 0; i < session.session_data.player.abilityMemory.length; i++){
                    let ability = session.session_data.player.abilityMemory[i]
                    memoryList.push({
                        label: ability.name,
                        description: "Add " + ability.name,
                        value: i.toString(),
                    })
                }

                
                actions4.addComponents(
                    new MessageSelectMenu()
                        .setCustomId('rememberAbility_' + session.session_id)
                        .setPlaceholder('Select an ability to remember')
                        .addOptions(memoryList),
                        
                );
                
                return [actions,actions2,actions3,actions4]
            } else {
                return [actions,actions2,actions3]
            }
        }
        if(actions.components.length > 0){
            return [actions,actions2]
        } else {
            return [actions2]
        }
    },
    populateManegeAbilityWindow(session){
        const embed = new MessageEmbed()
        .setColor("#7289da")

        if(session.session_data.noEdit){
            embed.setTitle(session.session_data.player.name)
            

            let fighter = session.session_data.fighter
            let statsString = "**Health: **" + fighter.liveData.stats.hp + "/" + fighter.liveData.maxhp + "\n"
            let stats = ["atk","def","spatk","spdef","spd"]
            statsString += ""
            for(s of stats){
                
                statsString += "**" + s + ": ** " + getFighterStat(fighter,s) +"\n"
            }
            embed.addField(
                "Stats",
                statsString
            ,true)
        } else {
            embed.setTitle("Your Abilities")
        }

        if(session.session_data.temp){
            if(session.session_data.temp.returnMessage){
                embed.addField("Ability Refunded",session.session_data.temp.returnMessage)
            }
        }
        

        let player = session.session_data.player

        let abilityString = ""
        for(var i = 0; i < player.abilities.length;i++){
            let abilityData = player.abilities[i]
            if(session.session_data.temp && session.session_data.temp.selected == parseInt(i)){
                abilityString += ">> " + abilityData.name + " <<\n"
            } else {
                abilityString += abilityData.name + "\n"
            }
            
        }
        embed.addField(
            "Abilities",
            abilityString
        ,true)
        
        if(session.session_data.temp){
            if(session.session_data.temp.selected != undefined){
                let selectedAbility = player.abilities[session.session_data.temp.selected]
                embed.addField(
                    "Selected Ability: " + selectedAbility.name,
                    "```" + createAbilityDescription(selectedAbility) + "```"
                )
            }
        }
        return [embed]
    }
}