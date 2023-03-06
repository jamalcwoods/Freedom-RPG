
const { token } = require("./private/credentials.json");
const fs = require('fs');
const { Client, Collection, Intents, MessageEmbed } = require('discord.js');
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });
const { getPlayerDBData, updatePlayerDBData, getTownDBData, updateTownDBData, updateAllTownDBData } = require("./firebaseTools")
const { clone, generateRNGEquipment, simulateCPUSPAssign, simulateCPUAbilityAssign, generateRNGAbility, calculateAbilityCost, runExpeditionStep, parseReward, levelTown } = require("./tools.js")
const data = require ("./data.json");
const { populateConformationControls } = require("./sessionTools.js")
const { off } = require("firebase/database");
const { callbackify } = require("util");
client.once('ready', () => {
	console.log('Ready!');
});

client.commands = new Collection();
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
	client.commands.set(command.data.name, command);
}

client.components = new Collection();
const componentFiles = fs.readdirSync('./components').filter(file => file.endsWith('.js'));

for (const file of componentFiles) {
	const component = require(`./components/${file}`);
	client.components.set(component.data.name, component);
}

let sessions = []


function updateSession(newSession){
    for(var i = 0;i < sessions.length; i++){
        let session = sessions[i]
        if(session.session_id == newSession.session_id && newSession.type == session.type){
            sessions[i] = newSession
            for(p of newSession.user_ids){
                updatePlayerDBData(p,"session",newSession.session_id)
            }
            break;
        }
    }
}

function removeSession(newSession){
    for(var i = 0;i < sessions.length; i++){
        let session = sessions[i]
        if(session.session_id == newSession.session_id && newSession.type == session.type){
            sessions.splice(i,1) 
            break;
        }
    }
    for(p of newSession.user_ids){
        updatePlayerDBData(p,"session",null)
    }
}

function addSession(newSession){
    sessions.push(newSession)
    for(p of newSession.user_ids){
        updatePlayerDBData(p,"session",newSession.session_id)
    }
}

function getUserSession(user){
    for(session of sessions){
        if(session.user_ids.includes(user.id)){
            return session
        }
    }
    return null
}

function getSessionByID(id){
    for(var i = 0;i < sessions.length; i++){
        let session = sessions[i]
        if(session.session_id == id){
            return session
        }
    }
    return null
}


function processResult(result){
    if(result.removeSession){
        removeSession(result.removeSession)
    }

    if(result.addSession){
        addSession(result.addSession)
    }

    if(result.updatePlayer){
        for(batch of result.updatePlayer){
            updatePlayerDBData(batch.id,batch.path,batch.value)
        }
    }

    if(result.updateSession){
        updateSession(result.updateSession)
    }

    if(result.updateTown){
        for(batch of result.updateTown){
            updateTownDBData(batch.id,batch.path,batch.value)
        }
    }
}

client.on('interactionCreate', async interaction => {  
    onPlayerPresence(interaction.user, async function(){
        switch(interaction.type){
            case "MESSAGE_COMPONENT":
                let componenetVals = interaction.customId.split("_")
                const component = client.components.get(componenetVals[0])
                let sessionID = componenetVals[1]
                let args = ""
                if(componenetVals[2]){
                    args = componenetVals[2].split("|")
                }
                try {
                    let componentConfig = {}
                    if(args != ""){
                        componentConfig.args = args
                    }
                    if(component.config.getClient){
                        componentConfig.client = client
                    }
                    if(component.config.getSession){
                        componentConfig.session = getSessionByID(sessionID)
                        if(componentConfig.session){
                            if(componentConfig.session.user_ids.includes(interaction.user.id)){
                                component.execute(interaction,componentConfig,processResult)
                            } else {
                                await interaction.reply({ content: "You are not a user of this component's session!", ephemeral: true });
                            }
                        } else {
                            await interaction.reply({ content: 'The session for this component no longer exists!', ephemeral: true });
                        }
                    } else if(component.config.addToSession){
                        if(getUserSession(interaction.user) == null){
                            getPlayerDBData(interaction.user,function(data){
                                if(!data && component.config.newPlayer != true){
                                    interaction.reply({ content: 'You need an account to preform this action, Do `/start` to create one', ephemeral: true });
                                } else {
                                    componentConfig.playerData = data
                                    componentConfig.session = getSessionByID(sessionID)
                                    if(componentConfig.session){
                                        if(!componentConfig.session.user_ids.includes(interaction.user.id)){
                                            component.execute(interaction,componentConfig,processResult)
                                        } else {
                                            interaction.reply({ content: "You are already added to this component's session!", ephemeral: true });
                                        }
                                    } else {
                                        interaction.reply({ content: 'The session for this component no longer exists!', ephemeral: true });
                                    }
                                }
                            })
                        } else {
                            interaction.reply({ content: 'You can not join a session while already in one', ephemeral: true });
                        }
                    } else {
                        if(component.config.getPlayerData){
                            getPlayerDBData(interaction.user,function(data){
                                componentConfig.playerData = data
                                component.execute(interaction,componentConfig,processResult)
                            })
                        } else {
                            component.execute(interaction,componentConfig,processResult)
                        }
                    }
                } catch (error){
                    console.error(error)
                    await interaction.reply({ content: 'There was an error interacting with this component!', ephemeral: true });
                }
                break;
            case "APPLICATION_COMMAND":
                if (!interaction.isCommand()) return;
    
                const command = client.commands.get(interaction.commandName);
            
                if (!command) return;
                try {
    
                    let choices  = interaction.options["_hoistedOptions"]
                    let commandConfig = {};
                    if(command.config){
                        if(getUserSession(interaction.user) == null || command.config.sessionCommand){
                            if(command.config.getSessions){
                                commandConfig.sessions = sessions
                            } 
                            if(choices){
                                commandConfig.choices = choices
                            }
                            if(command.config.getPlayerData){
                                if(command.config.getGuildTown){
                                    getTownDBData(interaction.guildId,function(town){
                                        getPlayerDBData(interaction.user,function(data){
                                            if(!data && command.config.newPlayer != true){
                                                interaction.reply({ content: 'You need an account to preform this command, Do `/start` to create one', ephemeral: true });
                                            } else {
                                                if(data.expedition){
                                                    interaction.reply({
                                                        content: 'Your character is currently on an expedition. Would you like to end your expedition?', 
                                                        components: populateConformationControls({type: "endExpedition"}),
                                                        ephemeral: true 
                                                    });
                                                } else {
                                                    commandConfig.townData = town
                                                    commandConfig.playerData = data
                                                    command.execute(interaction,commandConfig,processResult)
                                                }
                                            }
                                        })
                                    })
                                }  else {
                                    getPlayerDBData(interaction.user,function(data){
                                        if(!data && command.config.newPlayer != true){
                                            interaction.reply({ content: 'You need an account to preform this command, Do `/start` to create one', ephemeral: true });
                                        } else {
                                            if(data.expedition){
                                                interaction.reply({
                                                        content: 'Your character is currently on an expedition. Would you like to end your expedition?', 
                                                        components: populateConformationControls({type: "endExpedition"}),
                                                        ephemeral: true 
                                                });
                                            } else {
                                                commandConfig.playerData = data
                                                command.execute(interaction,commandConfig,processResult)
                                            }
                                        }
                                    })
                                }
                            } else {
                                await command.execute(interaction,commandConfig,processResult)
                            }
                        } else {
                            interaction.reply({ content: 'You may not run commands while in another session', ephemeral: true });
                        }
                    } else {
                        if(getUserSession(interaction.user) == null){
                            await command.execute(interaction,commandConfig,processResult)
                        } else {
                            interaction.reply({ content: 'You may not run commands while in another session', ephemeral: true });
                        }
                    }
                    
                } catch (error) {
                    console.error(error);
                    await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
                }
                break;  
        }
        fs.writeFile("sessions.json", JSON.stringify(sessions, null, 4),function(){})
    },{
        guildId:interaction.guildId,
        channelId:interaction.channelId,
        author:interaction.user
    }) 
});

let messageLog = {}

client.on('messageCreate', async message =>{
    if(!message.author.bot && message.guildId){
        onPlayerPresence(message.author,null,message)
    }
})

function onPlayerPresence(user,callback,message){
    if(messageLog[message.guildId] == undefined){
        messageLog[message.guildId] = {}
        messageLog[message.guildId][message.author.id] = true
    } else {
        if(messageLog[message.guildId][message.author.id] == undefined){
            messageLog[message.guildId][message.author.id] = true
        } 
    }
    getTownDBData(message.guildId,function(town){
        if(!town){
            client.guilds.fetch(message.guildId).then(guild =>{
                let town = data.templates.emptyTownData
                town.name = guild.name
                town.id = guild.id
                town.regions = []
                while(town.regions.length < 2){
                    let region = data.regions[Math.floor(Math.random() * data.regions.length)]
                    if(!town.regions.includes(region)){
                        town.regions.push(region)
                    }
                }
                updateTownDBData(message.guildId,"",town,function(){
                    playerPresenceCheck(message,user,town,callback)
                })
            })
        } else {
            playerPresenceCheck(message,user,town,callback)
        }
    })
}

function playerPresenceCheck(message,user,town,callback){
    getPlayerDBData(user,function(result){
        if(result.session && getSessionByID(result.session) == null){
            delete result.session
        }
        let now = new Date();
        if(result && !result.session && !result.dungeon && !result.expedition){
            let player = result

            let needToUpdatePlayer = false
            let needToUpdateTown = false

            if(player.dailyTimer <= now.getTime()){
                player.dailyTimer = now.getTime() + 86400000

                player.dailyCount++ 


                let expAmount;
                if(player.level < 5){
                    expAmount = player.expCap - player.exp
                } else {
                    expAmount = Math.ceil(player.expCap * 0.25)
                    if(expAmount < 400){
                        expAmount = 400
                    }
                }

                let rewardsText = ""
                let result;
                
                result = parseReward({
                    type:"resource",
                    resource:"exp",
                    resourceName: "experience",
                    amount: expAmount
                }, player)
                player = result[0]
                for(msg of result[1]){
                    rewardsText += msg + "\n"
                }

                result = parseReward({
                    type:"resource",
                    resource:"gold",
                    resourceName:"gold",
                    amount: 20
                }, player)
                player = result[0]
                for(msg of result[1]){
                    rewardsText += msg + "\n"
                }

                needToUpdatePlayer = true 

                const embed = new MessageEmbed()
                embed.setColor("#7289da")
                embed.setTitle("Daily Login #" +  player.dailyCount)

                embed.addField("Rewards",rewardsText)
                client.channels.fetch(message.channelId).then(channel =>{
                    channel.send({
                        content: " ",
                        embeds:[embed]
                    })   
                })
            }

            if(player.challengeTimer <= now.getTime()){
                player.challengeTimer = now.getTime() + 28800000
                if(!player.challenges){
                    player.challenges = []
                }
                if(player.challenges.length < 5){
                    let rankmap = {
                        1:1,
                        2:2,
                        3:4
                    }
                    let type = Math.floor(Math.random() * data.challengeDict.length)
                    let dupe = false;
                    for(c of player.challenges){
                        if(c.type == type){
                            dupe = true
                            break;
                        }
                    }
                    while(dupe){
                        dupe = false
                        type = Math.floor(Math.random() * data.challengeDict.length)
                        for(c of player.challenges){
                            if(c.type == type){
                                dupe = true
                                break;
                            }
                        }
                    }
                    let rank = Math.ceil(Math.random() * 3)
                    player.challenges.push({
                        type:type,
                        rank:rank,
                        progress:0,
                        goal:data.challengeDict[type].baseGoal * rankmap[rank]
                    })
                    needToUpdatePlayer = true
                }
            }

            if(player.presenceTimer <= now.getTime()){
                player.presenceTimer = now.getTime() + 1000
                let resourcesAdded = 0
                let resourceMap = ["minerals","wood","food"]
                if(player.job == "exp"){
                    let levelUp = player.exp + 25 >= player.expCap
                    let result = parseReward({
                        type:"resource",
                        resource:"exp",
                        resourceName: "experience",
                        amount: 25
                    }, player)
                    player = result[0]
                    if(levelUp){
                        let text = ""
                        for(msg of result[1]){
                            text += "\n" + msg
                        }
                        const embed = new MessageEmbed()
                        embed.setColor("#7289da")
                        embed.setTitle("Level Up!")
                        embed.addField("---",player.name + " is now level " + player.level + "!")
                        client.channels.fetch(message.channelId).then(channel=>{
                            channel.send({embeds:[embed]})
                        })
                    }
                    let index = Math.floor(Math.random() * resourceMap.length)
                    if(town.resources[resourceMap[index]][0] + 1 < town.resources[resourceMap[index]][1]){
                        town.resources[resourceMap[index]][0] += 1
                        resourcesAdded = 1
                    } else {
                        resourcesAdded = town.resources[resourceMap[index]][1] - town.resources[resourceMap[index]][0]
                        town.resources[resourceMap[index]][0] = town.resources[resourceMap[index]][1] 
                    }
                    needToUpdatePlayer = true
                    needToUpdateTown = true
                } else {
                    if(town.resources[resourceMap[player.job]][0] + 3< town.resources[resourceMap[player.job]][1]){
                        town.resources[resourceMap[player.job]][0] += 3
                        resourcesAdded = 3
                    } else {
                        resourcesAdded = town.resources[resourceMap[player.job]][1] - town.resources[resourceMap[player.job]][0]
                        town.resources[resourceMap[player.job]][0] = town.resources[resourceMap[player.job]][1] 
                    }
                    needToUpdatePlayer = true
                    needToUpdateTown = true
                }
                if(!town.contributors){
                    town.contributors = {}
                }
                if(!town.contributors[player.id]){
                    town.contributors[player.id] = resourcesAdded
                } else {
                    town.contributors[player.id] += resourcesAdded
                }
                town = levelTown(town)
            }

            if(needToUpdatePlayer && needToUpdateTown){
                updatePlayerDBData(player.id,"",player,function(){
                    updateTownDBData(town.id,"",town,function(){
                        if(callback){
                            callback()
                        }
                    })
                })
            } else if(needToUpdateTown){
                updatePlayerDBData(player.id,"",player,function(){
                    if(callback){
                        callback()
                    }
                })
            } else if(needToUpdateTown){
                updateTownDBData(town.id,"",town,function(){
                    if(callback){
                        callback()
                    }
                })
            }
        } else {
            if(callback){
                callback()
            }
        }
    })
}


setInterval(() => {
    getPlayerDBData({id:""},function(players){
        getTownDBData("",function(towns){
            for(town in towns){
                let chatLog = messageLog[town]
                let townData = towns[town]

                let updates = []

                //Check Chatlog
                if(chatLog){
                    for(user in chatLog){
                        if(!players[user]){
                            let resourceMap = ["minerals","wood","food"]
                            let index = Math.floor(Math.random() * resourceMap.length)
                            townData.resources[resourceMap[index]][0] += 1
                            if(townData.resources[resourceMap[index]][0] > townData.resources[resourceMap[index]][1]){
                                townData.resources[resourceMap[index]][0] = townData.resources[resourceMap[index]][1] 
                            }
                        }
                    }
                }
                townData = levelTown(townData)
                let now = new Date();

                //Update Raid
                if(townData.lastRaid < now.getTime()){
                    if(!townData.bossDefeats){
                        townData.points -= townData.level * 7
                        if(townData.points < 0){
                            townData.points = 0
                        }
                    }
                    townData.lastRaid = now.getTime() + 86400000
                    let missionAmount = [2,2,1]
                    let missionDepth = [5,3,3]
                    let missions = [
                        [],
                        [],
                        []
                    ]
                    for(x in missionAmount){
                        let amount = missionAmount[x]
                        let typeData = []
                        for(var i = 0; i < amount; i++){
                            let val = Math.floor(Math.random() * missionDepth[x])
                            while(typeData.includes(val)){
                                val = Math.floor(Math.random() * missionDepth[x])
                            }
                            typeData.push(val)
                        }
                        for(t of typeData){
                            missions[x].push({
                                type:t
                            })
                        }
                    }
                    let bossEquipment = generateRNGEquipment(
                    {
                        ref:{
                            "type": "rngEquipment",
                            "rngEquipment": {
                                "scaling": false,
                                "value":1,
                                "conValue": 0,
                                "lockStatTypes": false,
                                "baseVal": 100,
                                "types": [
                                    "gear"
                                ]
                            }
                        }
                    })
                    let boss = {
                        name:data.raidBossNames[Math.floor(Math.random()*data.raidBossNames.length)],
                        id:"raidBoss",
                        cpu:true,
                        faction:"-1",
                        race:"0",
                        combatStyle:"0",
                        exp:0,
                        abilitypoints:0,
                        statpoints:0,
                        lives:1,
                        abilities:[],
                        inventory:[bossEquipment],
                        weapon: bossEquipment.type == "weapon" ? 0 : null,
                        gear: bossEquipment.type == "gear" ? 0 : null,
                        level:0,
                        totalExp:0,
                        stats:{
                            "hp":30,
                            "atk":15,
                            "def":15,
                            "spatk":15,
                            "spdef":15,
                            "spd":15
                        }
                    }
                    boss = simulateCPUAbilityAssign(boss,[],10)
                    boss = simulateCPUSPAssign(clone(boss),townData.level * 60)
                    townData.raid = {
                        leader:{
                            name:boss.name,
                            unit:boss,
                            equipment:bossEquipment
                        },
                        missions:missions,
                        completion:0
                    }
                }

                //Restock Tasks
                if(townData.taskRestock < now.getTime()){
                    townData.taskRestock = now.getTime() + 86400000
                    townData.taskList = []
                    while(townData.taskList.length < 3){
                        let newTask = data.townTasks[Math.floor(Math.random() * data.townTasks.length)]
                        // let repeat = false;
                        // for(task of townData.taskList){
                        //     if(task.id == newTask.id){
                        //         repeat = true
                        //         break;
                        //     }
                        // }
                        // while(repeat){
                        //     repeat = false
                        //     newTask = data.townTasks[Math.floor(Math.random() * data.townTasks.length)]
                        //     for(task of townData.taskList){
                        //         if(task.id == newTask.id){
                        //             repeat = true
                        //             break;
                        //         }
                        //     }
                        // }
                        townData.taskList.push(newTask)
                    }
                }

                //Restock Market
                if(townData.marketRestock < now.getTime()){
                    townData.marketRestock = now.getTime() + 86400000
                    townData.listings = []
                    for(var i = 0; i < 4;i++){
                        let val = 0.5 + (Math.random() * 2)
                        let newData = {
                            ref:{
                                type: "rngEquipment",
                                rngEquipment: {
                                    scaling: false,
                                    value:1,
                                    conValue:0,
                                    lockStatTypes: true,
                                    baseVal: 20,
                                    types: i % 2 == 0 ? ["weapon"] : ["gear"]
                                }
                            }
                        }
                        newData.ref.rngEquipment.baseVal = Math.ceil(val * newData.ref.rngEquipment.baseVal)
                        let item = generateRNGEquipment(newData)
                        townData.listings.push([item,Math.ceil(val * 30)])
                    }
                }

                //Restock Training
                if(townData.trainingRestock < now.getTime()){
                    townData.trainingRestock = now.getTime() + 86400000
                    townData.availableAbilities = []
                    for(var i = 0; i < 3;i++){
                        let newData = {
                            baseVal: 25,
                            conSteps:1,
                            forceType: ["attack","guard","stats"][i % 3],
                            forceStats: false
                        }
                        let ability = generateRNGAbility(newData)
                        let val = calculateAbilityCost(ability)/newData.baseVal
                        townData.availableAbilities.push([ability,Math.ceil(val * 37.5)])
                    }
                }

                //Update Battle Hall
                if(townData.hallReset < now.getTime()){
                    townData.hallReset = now.getTime() + 86400000
                    townData.hallOwner = {
                        name:"Hall Warden",
                        id:"hallNPC",
                        cpu:true,
                        faction:"-1",
                        race:"0",
                        combatStyle:"0",
                        exp:0,
                        abilitypoints:0,
                        statpoints:0,
                        lives:1,
                        abilities:[],
                        level:12,
                        totalExp:0,
                        stats:{
                            "hp":22,
                            "atk":11,
                            "def":11,
                            "spatk":11,
                            "spdef":11,
                            "spd":11
                        }
                    }
                }
                

                //Manage Expeditions
                if(townData.expeditions){
                    for(var i = 0; i < townData.expeditions.length; i++){
                        let expedition = townData.expeditions[i]

                        let active;
                        if(chatLog){
                            active = chatLog[expedition.playerID]
                        } else {
                            active = false
                        }

                        let stepResult = runExpeditionStep(expedition,active,townData,players[expedition.playerID])
                        if(stepResult){
                            players[expedition.playerID] = stepResult[1]
                            client.guilds.fetch(town).then(guild =>{
                                guild.members.fetch(stepResult[1].id).then(member =>{ 
                                    member.createDM().then(dm =>{
                                        const embed = new MessageEmbed()
                                        .setColor('#00ff00')
                                        .setTitle("Expedition Event")

                                        embed.addField("---",stepResult[0])
                                        dm.send({embeds:[embed]})
                                    })
                                })
                            })
                            let found = false;
                            for(var i = 0;i < updates.length;i ++){
                                let u = updates[i]
                                if(u.id == expedition.playerID){
                                    updates[i] = {
                                        id:expedition.playerID,
                                        path:"",
                                        value:players[expedition.playerID]
                                    }
                                    found = true
                                    break;
                                }
                            }
                            if(!found){
                                updates.push({
                                    id:expedition.playerID,
                                    path:"",
                                    value:players[expedition.playerID]
                                })
                            }
                        }
                    }
                }
                
                for(batch of updates){
                    updatePlayerDBData(batch.id,batch.path,batch.value)
                }
            }
            updateAllTownDBData(towns)
            messageLog = {}
        })
    })      
}, 5000);
//}, 300000);

client.login(token);