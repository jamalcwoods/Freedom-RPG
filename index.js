
const { token } = require("./private/credentials.json");
const fs = require('fs');
const { Client, Collection, Intents } = require('discord.js');
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });
const { getPlayerDBData, updatePlayerDBData, getTownDBData, updateTownDBData, updateAllTownDBData } = require("./firebaseTools")
const { clone, generateRNGEquipment, simulateCPUSPAssign, simulateCPUAbilityAssign, generateRNGAbility, calculateAbilityCost } = require("./tools.js")
const data = require ("./data.json")
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
}

function addSession(newSession){
    sessions.push(newSession)
}

function checkUserSession(user){
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
}


function processResult(result){
    if(result.addSession){
        addSession(result.addSession)
    }
    if(result.updateSession){
        updateSession(result.updateSession)
    }
    if(result.removeSession){
        removeSession(result.removeSession)
    }

    if(result.updatePlayer){
        for(batch of result.updatePlayer){
            updatePlayerDBData(batch.id,batch.path,batch.value)
        }
    }

    if(result.updateTown){
        for(batch of result.updateTown){
            updateTownDBData(batch.id,batch.path,batch.value)
        }
    }
}

client.on('interactionCreate', async interaction => {
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
                    if(checkUserSession(interaction.user) == null){
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
                    component.execute(interaction,componentConfig,processResult)
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
                    if(checkUserSession(interaction.user) == null || command.config.sessionCommand){
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
                                            commandConfig.townData = town
                                            commandConfig.playerData = data
                                            command.execute(interaction,commandConfig,processResult)
                                        }
                                    })
                                })
                            }  else {
                                getPlayerDBData(interaction.user,function(data){
                                    if(!data && command.config.newPlayer != true){
                                        interaction.reply({ content: 'You need an account to preform this command, Do `/start` to create one', ephemeral: true });
                                    } else {
                                        commandConfig.playerData = data
                                        command.execute(interaction,commandConfig,processResult)
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
                    if(checkUserSession(interaction.user) == null){
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
});

let messageLog = {}

client.on('messageCreate', async message =>{
    if(!message.author.bot && message.guildId){
        if(messageLog[message.guildId] == undefined){
            messageLog[message.guildId] = {}
            messageLog[message.guildId][message.author.id] = true
        } else {
            if(messageLog[message.guildId][message.author.id] == undefined){
                messageLog[message.guildId][message.author.id] = true
            } 
        }
        getTownDBData(message.guildId,function(result){
            if(!result){
                client.guilds.fetch(message.guildId).then(guild =>{
                    let town = data.templates.emptyTownData
                    town.name = guild.name
                    console.log(town)
                    updateTownDBData(message.guildId,"",town)
                })
            }
        })
    }
})

setInterval(() => {
    getPlayerDBData({id:""},function(players){
        getTownDBData("",function(towns){
            for(town in towns){
                let chatLog = messageLog[town]
                let townData = towns[town]

                //Check Chatlog
                if(chatLog){
                    if(!townData.facilities){
                        townData.facilities = []
                    }
                    for(user in chatLog){
                        let resourceMap = ["reputation","minerals","wood","food"]
                        if(players[user].job == "0"){
                            townData.resources[resourceMap[players[user].job]] += 1
                        } else {
                            townData.resources[resourceMap[players[user].job]][0] += 1
                            if(townData.resources[resourceMap[players[user].job]][0] > townData.resources[resourceMap[players[user].job]][1]){
                                townData.resources[resourceMap[players[user].job]][0] = townData.resources[resourceMap[players[user].job]][1] 
                            }
                        }
                    }
                    let foodCheck = townData.resources.food[0] < townData.resources.food[1]
                    let woodCheck = townData.resources.wood[0] < townData.resources.wood[1]   
                    let mineralsCheck = townData.resources.minerals[0] < townData.resources.minerals[1]
                    let nextBuild = foodCheck && woodCheck && mineralsCheck
                    nextBuild = true
                    while(nextBuild){
                        if(townData.facilities[townData.facilityQueue]){
                            townData.facilities[townData.facilityQueue].level++ 
                        } else {
                            townData.facilities[townData.facilityQueue] = data.facilityData[townData.facilityQueue]
                        }
                        townData.facilityQueue++
                        if(townData.facilityQueue > data.facilityData.length - 1){
                            townData.facilityQueue = 0
                        }
                        nextBuild = false
                    }
                }
                let now = new Date();

                //Update Raid
                if(townData.lastRaid < now.getTime()){
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
                                type:t,
                                completers:{
                                    163809334852190208:{
                                        times:1,
                                        progression:[0,data.raidPresets.missionGoalValues[x][t]]
                                    }
                                }
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
                                "lockStatTypes": true,
                                "baseVal": 100,
                                "types": [
                                    "weapon",
                                    "gear"
                                ]
                            }
                        }
                    })
                    let boss = {
                        name:"Raid Boss",
                        id:"raidBoss",
                        cpu:true,
                        faction:"-1",
                        race:"0",
                        combatStyle:"0",
                        exp:0,
                        skillpoints:0,
                        lives:1,
                        abilities:[],
                        inventory:[bossEquipment],
                        weapon: bossEquipment.type == "weapon" ? 0 : null,
                        gear: bossEquipment.type == "gear" ? 0 : null,
                        level:30,
                        totalExp:0,
                        stats:{
                            "hp":50,
                            "atk":25,
                            "def":25,
                            "spatk":25,
                            "spdef":25,
                            "spd":25
                        }
                    }
                    boss = simulateCPUAbilityAssign(boss,[],10)
                    boss = simulateCPUSPAssign(clone(boss),10 * 6)
                    townData.raid = {
                        leader:{
                            name:"Raid Boss",
                            unit:boss,
                            equipment:bossEquipment
                        },
                        missions:missions,
                        bossDefeats:{
                            "163809334852190208":{
                                times: Math.floor(Math.random() * 10)
                            }
                        },
                        completion:0
                    }
                }

                //Restock Market
                if(townData.marketRestock < now.getTime()){
                    townData.marketRestock = now.getTime() + 86400000
                    let hasMarket = false;
                    for(f of townData.facilities){
                        if(f.value == "market"){
                            hasMarket = true
                            break;
                        }
                    }
                    if(hasMarket){
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
                        console.log(townData.listings)
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
                
            }
            updateAllTownDBData(towns)
            
        })
    })      
    messageLog = {}
}, 10000);

client.login(token);