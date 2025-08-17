
const { token } = require("./private/credentials.json");
const fs = require('fs');
const { Client, Collection, Intents, MessageEmbed, MessageActionRow, MessageButton, MessageSelectMenu} = require('discord.js');
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES, Intents.FLAGS.GUILD_VOICE_STATES] });
const { getPlayerDBData, updatePlayerDBData, getTownDBData, updateTownDBData, updateAllTownDBData, getPotentialData, updatePotentialData } = require("./firebaseTools")
const { clone, generateRNGEquipment, simulateCPUSPAssign, simulateCPUAbilityAssign, generateRNGAbility, calculateAbilityCost, createAbilityDescription, runExpeditionStep, parseReward, formatTown, weightedRandom, generateEquipmentName } = require("./tools.js")
const data = require ("./data.json");
const { populateConformationControls } = require("./sessionTools.js")

client.once('ready', () => {
	console.log('Ready!');
    client.user.setActivity("Freedom RPG: (/start)"); 
    client.channels.fetch("1232765826231308419").then(channel =>{
        const embed = new MessageEmbed()

        embed.addFields(
            { name: 'BOT REBOOT', value: "Time of reboot: " + new Date().toString() + "\n\nPlayer sessions have been cleared, apologies for the inconvenience" }
        )

        channel.send({
            content:" ",
            embeds:[embed]
        })
    })
    botUpdate()
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
        }

        if(session.session_data.subSession == newSession.session_id && session.session_data.removeOnUpdate){
            removeSession(session)
        }
    }
}


function removeSession(newSession){
    for(var i = 0;i < sessions.length; i++){
        let session = sessions[i]
        if(session.session_data.subSession == newSession.session_id && session.session_data.removeOnUpdate){
            removeSession(session)
        }
    }

    for(var i = 0;i < sessions.length; i++){
        let session = sessions[i]
        if(session.session_id == newSession.session_id && newSession.type == session.type){
            sessions.splice(i,1) 
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

function unHoldSession(id){
    for(var i = 0;i < sessions.length; i++){
        let session = sessions[i]
        if(session.session_id == id){
            delete session.session_data.onHold;
        }
    }
}

function updateSessionPlayer(updates){
    for(u of updates){
        let session = getSessionByID(u.session)
        switch(u.prop){
            case "lessonNum":
                if(!session.session_data.player.lessons){
                    session.session_data.player.lessons = clone(data.templates.emptyPlayerData.lessons)
                }
                session.session_data.player.lessons[u.val] = true
                break;
        }
    }
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

    if(result.unHoldSession){
        unHoldSession(result.unHoldSession)
    }

    if(result.updateSessionPlayer){
        updateSessionPlayer(result.updateSessionPlayer)
    }
}

client.on('interactionCreate', async interaction => {  
    onPlayerPresence(interaction.user, async function(){
        switch(interaction.type){
            case "MESSAGE_COMPONENT":
                let componenetVals = interaction.customId.split("_")
                console.log(interaction.user.username,componenetVals)
                const component = client.components.get(componenetVals[0])
                let sessionID = componenetVals[1]
                if(sessionID == "NULL"){
                    sessionID = null
                }
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
                    if(component.config.getSessions){
                        componentConfig.sessions = sessions
                    } 
                    if(component.config.getSession){
                        if(component.config.onlySessionID){
                            componentConfig.session = sessionID
                            component.execute(interaction,componentConfig,processResult)
                        } else {
                            componentConfig.session = getSessionByID(sessionID)
                            if(componentConfig.session){
                                if(componentConfig.session.user_ids.includes(interaction.user.id)){
                                    component.execute(interaction,componentConfig,processResult)
                                } else {
                                    await interaction.reply({ content: "You are not a user of this component's session!", ephemeral: true });
                                }
                            } else {
                                interaction.message.delete()
                                await interaction.reply({ content: 'The session for this component no longer exists!', ephemeral: true });
                            }
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
                                        interaction.message.delete()
                                        interaction.reply({ content: 'The session for this component no longer exists!', ephemeral: true });
                                    }
                                } 
                            })
                        } else {
                            interaction.reply({ content: 'You can not join a session while already in one', ephemeral: true });
                        }
                    } else {
                        if(component.config.getPlayerData && component.config.getGuildTown){
                            getTownDBData(interaction.guildId,function(town){
                                getPlayerDBData(interaction.user,function(data){
                                    componentConfig.playerData = data
                                    componentConfig.townData = town
                                    component.execute(interaction,componentConfig,processResult)
                                })
                            })
                        } else if(component.config.getPlayerData){
                            getPlayerDBData(interaction.user,function(data){
                                componentConfig.playerData = data
                                component.execute(interaction,componentConfig,processResult)
                            })
                            
                        } else if(component.config.getGuildTown){
                            getTownDBData(interaction.guildId,function(town){
                                componentConfig.townData = town
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
    
                    let choices = interaction.options["_hoistedOptions"]
                    console.log(interaction.user.username,interaction.commandName)
                    for(var i = 0; i < choices.length;i++){
                        console.log(choices[i].name + ": " + choices[i].value)
                    }
                    let commandConfig = {};
                    if(command.config){
                        if(getUserSession(interaction.user) == null || command.config.sessionCommand){
                            if(command.config.getSessions){
                                commandConfig.sessions = sessions
                            } 
                            if(choices){
                                commandConfig.choices = choices
                            }
                            if(command.config.getClient){
                                commandConfig.client = client
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

client.on('voiceStateUpdate', async (oldState, newState) =>{
    if(oldState.channelId != newState.channelId){
        let voiceState;
        if(oldState.channelId == null){
            voiceState = newState
        } else {
            voiceState = oldState
        }
        let message = {
            author:voiceState.member,
            guildId:voiceState.guild.id,
            channelId:voiceState.channel.id
        }

        if(!message.author.bot){
            onPlayerPresence(message.author,null,message)
        }
    }
})

client.on('messageCreate', async message =>{
    if(!message.author.bot && message.guildId){
        onPlayerPresence(message.author,null,message)
    }
})

function onPlayerPresence(user,callback,message){
    let intervalMsg = false;
    if(messageLog[message.guildId] == undefined){
        messageLog[message.guildId] = {}
        messageLog[message.guildId][message.author.id] = true
        intervalMsg = true
    } else {
        if(messageLog[message.guildId][message.author.id] == undefined){
            messageLog[message.guildId][message.author.id] = true
            intervalMsg = true
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
                    playerPresenceCheck(message,user,town,intervalMsg,callback)
                })
            })
        } else {
            playerPresenceCheck(message,user,town,intervalMsg,callback)
        }
    })
}

function playerPresenceCheck(message,user,town,intervalMsg,callback){
    getPotentialData(function(potential){
        getPlayerDBData(user,function(result){
            if(result.session && getSessionByID(result.session) == null){
                delete result.session
            }
            if(result.dungeon && getSessionByID(result.dungeon) == null){
                delete result.dungeon
            }
            let now = new Date();
            if(result && !result.session && !result.dungeon && !result.expedition){
                console.log(result.name + " - pressence")
                let player = result

                let needToUpdatePlayer = false
                let needToUpdateTown = false

                if(player.tutorial == "completed"){
                    if(player.dailyTimer <= now.getTime() || (player.id == '163809334852190208' && message.content == "daily")){
                        player.dailyTimer = now.getTime() + 86400000

                        player.dailyCount++ 

                        let expAmount;
                        if(player.level < 10){
                            expAmount = player.expCap - player.exp
                        } else {
                            expAmount = Math.ceil(player.expCap * 0.33)
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
                            amount: 20 * player.dailyCount
                        }, player)
                        player = result[0]
                        for(msg of result[1]){
                            rewardsText += msg + "\n"
                        }

                        result = parseReward({
                            type:"resource",
                            resource:"abilitypoints",
                            resourceName:"ability points",
                            amount: 2 * player.dailyCount
                        }, player)
                        player = result[0]
                        for(msg of result[1]){
                            rewardsText += msg + "\n"
                        }

                        needToUpdatePlayer = true 

                        const embed = new MessageEmbed()
                        embed.setColor("#7289da")
                        embed.setTitle("Daily Login #" +  player.dailyCount)

                        embed.addField("Thank You!","The Freedom RPG Team thanks you for your continued support!\n \-Spiné")

                        let challenge = Math.floor(Math.random() * 3)
                        let challengeText = ""
                        switch(challenge){
                            case 0:
                                challengeText = "Select a dungeon by visiting an adventure hall and clear a level " + Math.ceil(player.level/10) + " dungeon run"
                                break;

                            case 1:
                                challengeText = "Support the town by visiting a militia hall and earning a total of 20 town points by completing missions"
                                break;

                            case 2:
                                challengeText = "View your current challenges and complete one with an unmastered weapon to earn a gold reward"
                                break;
                        }

                        challengeText += "\n\n**Hint**\nUse the drop down below to quickly access what is needed for your daily task"
                        
                        embed.addField("Daily Task",challengeText)

                        player.dailyText = rewardsText
                        player.dailyChallenge = challenge
                        player.dailyChallengeProgress = 0

                        let actionOptions = [
                            {
                                label: "View Challenges",
                                description: "View your current challenges",
                                value: "challenges",
                            },
                            {
                                label: "Support Town",
                                description: "Visit this town's militia hall",
                                value: "militia",
                            },
                            {
                                label: "Select a Dungeon",
                                description: "Visit this town's adventure hall to begin a dungeon run",
                                value: "adventure",
                            },
                            {
                                label: "Explore Wild",
                                description: "Venture out into the wild",
                                value: "explore",
                            },
                            {
                                label: "View Rewards",
                                description: "View your daily rewards",
                                value: "rewards",
                            },
                            {
                                label: "View Profile",
                                description: "View your profile",
                                value: "profile",
                            }           
                        ]

                        let optionRow = new MessageActionRow()
                        .addComponents(
                            new MessageSelectMenu()
                            .setCustomId('dailySelection_NULL_' + player.id)
                            .setPlaceholder('Action Quickselect')
                            .addOptions(actionOptions)
                        )

                        let removeRow = new MessageActionRow()
                        .addComponents(
                            new MessageButton()
                            .setCustomId('deleteMessage_NULL_' + player.id)
                            .setLabel("Dismiss")
                            .setStyle('DANGER'))
                        client.channels.fetch(message.channelId).then(channel =>{
                            console.log("Sending daily to " + player.name)
                            channel.send({
                                content:"<@" + user.id + ">",
                                embeds:[embed],
                                components:[optionRow,removeRow]
                            }) 
                        })
                    }

                    if(player.challengeTimer <= now.getTime()){
                        //600000
                        player.challengeTimer = now.getTime() + 600000
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
                        //600000
                        player.presenceTimer = now.getTime() + 600000
                        let resourcesAdded = 0
                        let resourceMap = ["minerals","wood","food"]
                        if(player.job == "exp"){
                            let levelUp = player.exp + 40 >= player.expCap
                            let result = parseReward({
                                type:"resource",
                                resource:"exp",
                                resourceName: "experience",
                                amount: 40
                            }, player)
                            player = result[0]
                            if(levelUp){
                                let text = ""
                                for(msg of result[1]){
                                    text += "\n" + msg
                                }
                                const embed = new MessageEmbed()
                                embed.setColor("#7289da")
                                embed.addField("Level Up!",text)
                                
                                let removeRow = new MessageActionRow()
                                .addComponents(
                                    new MessageButton()
                                    .setCustomId('deleteMessage')
                                    .setLabel("Dismiss")
                                    .setStyle('DANGER'))
                                .addComponents(
                                    new MessageButton()
                                    .setCustomId('profilePopUp_NULL_' + player.id + '|' + message.author.avatar)
                                    .setLabel("View Stats")
                                    .setStyle('PRIMARY'))
                                client.channels.fetch(message.channelId).then(channel=>{
                                    channel.send({
                                        embeds:[embed],
                                        components:[removeRow]
                                    })
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
                            if(town.resources[resourceMap[player.job]][0] + 5 < town.resources[resourceMap[player.job]][1]){
                                town.resources[resourceMap[player.job]][0] += 5
                                resourcesAdded = 5
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
                        town = formatTown(town)
                    }
                } else {
                    if(player.dailyTimer <= now.getTime() || (player.id == '163809334852190208' && message.content == "daily")){
                        player.dailyTimer = now.getTime() + 86400000

                        const embed = new MessageEmbed()
                        embed.setColor("#7289da")
                        embed.setTitle("Tutorial Incomplete")

                        embed.addField("Reminder","Complete the tutorial by doing `/tutorial` and following instructions shown to earn rewards over time")

                        let removeRow = new MessageActionRow()
                        .addComponents(
                            new MessageButton()
                            .setCustomId('deleteMessage')
                            .setLabel("Dismiss")
                            .setStyle('DANGER'))

                        client.channels.fetch(message.channelId).then(channel =>{
                            console.log("Sending tutorial reminder to " + player.name)
                            channel.send({
                                content:"<@" + user.id + ">",
                                embeds:[embed],
                                components:[removeRow]
                            }) 
                        })

                        needToUpdatePlayer = true
                    }
                }

                if(needToUpdatePlayer && needToUpdateTown){
                    updatePlayerDBData(player.id,"",player,function(){
                        updateTownDBData(town.id,"",town,function(){
                            if(callback){
                                callback()
                            }
                        })
                    })
                } else if(needToUpdatePlayer){
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
                } else {
                    if(callback){
                        callback()
                    }
                }
            } else {
                if(!result && intervalMsg){
                    if(!potential){
                        potential = {}
                    }
                    if(potential[user.id]){
                        potential[user.id].count++
                    } else {
                        potential[user.id] = {
                            count:1
                        }
                    }
                    if(potential[user.id].count % 25 == 0){
                        const embed = new MessageEmbed()
                                embed.setColor("#7289da")
                                embed.addField("Bonus Achieved!","You can use the /start command to gain an improved start\n*(Start game with " + potential[user.id].count + " bonus skill points for stat customization)*")
                                
                        let removeRow = new MessageActionRow()
                        .addComponents(
                            new MessageButton()
                            .setCustomId('deleteMessage')
                            .setLabel("Dismiss")
                            .setStyle('DANGER'))

                        console.log("Pressence User" + user)
                        if(user.user){
                            client.channels.fetch(message.channelId).then(channel=>{
                                console.log("Sending invitation to " + user.user.username)
                                channel.send({
                                    content:"<@" + user.user.id + ">",
                                    embeds:[embed],
                                    components:[removeRow]
                                })
                            })
                        } else {
                            client.channels.fetch(message.channelId).then(channel=>{
                                console.log("Sending invitation to " + user.username)
                                channel.send({
                                    content:"<@" + user.id + ">",
                                    embeds:[embed],
                                    components:[removeRow]
                                })
                            })
                        }
                        
                    }
                    updatePotentialData(potential)
                }
                if(callback){
                    callback()
                }
            }
        })
    })
}


//Interval Tester
// setInterval(() => {
//     let val = Math.ceil(50 + Math.random() * 50)
//     let newData = {
//         ref:{
//             type: "rngEquipment",
//             rngEquipment: {
//                 scaling: false,
//                 value:1,
//                 conStats:1,
//                 conValue:0.2,
//                 lockStatTypes: true,
//                 baseVal: val,
//                 types: ["gear","weapon"]
//             }
//         }
//     }
    
//     let item = generateRNGEquipment(newData)
//     console.log(val,item)
// }, 5000)

function botUpdate(){
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
                townData = formatTown(townData)
                let now = new Date();

                //Update Raid
                if(townData.lastRaid < now.getTime()){
                    if(townData.raid && !townData.raid.bossDefeats){
                        townData.points -= townData.level * 7
                        if(townData.points < 0){
                            townData.points = 0
                        }
                    }
                    townData.lastRaid = now.getTime() + (86400000 * 3)
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
                                "conStats":1,
                                "conValue": 0.2,
                                "lockStatTypes": false,
                                "baseVal": 15 * townData.level,
                                "types": [
                                    "gear",
                                    "weapon"
                                ]
                            }
                        }
                    })
                    let bossName = data.raidBossNames[Math.floor(Math.random()*data.raidBossNames.length)]
                    bossEquipment.name = bossName + "'s " + bossEquipment.name
                    let boss = {
                        name:bossName,
                        tele:0.3,
                        id:"raidBoss",
                        cpu:true,
                        faction:"-1",
                        race:"0",
                        combatStyle:"0",
                        exp:0,
                        abilitypoints:0,
                        statpoints:0,
                        lives:3,
                        abilities:[],
                        inventory:[bossEquipment],
                        weapon: bossEquipment.type == "weapon" ? 0 : null,
                        gear: bossEquipment.type == "gear" ? 0 : null,
                        level:0,
                        totalExp:0,
                        stats:{
                            "hp":25,
                            "atk":15,
                            "def":15,
                            "spatk":15,
                            "spdef":15,
                            "spd":15
                        }
                    }
                    let passives = []
                    while(passives.length < 3){
                        let id = Math.floor(Math.random() * data.passiveDescriptions.length)
                        if(!passives.includes(id)){
                            passives.push(id)
                        }
                    }
                    boss.passives = []
                    for(var i = 0; i < passives.length; i++){
                        boss.passives.push({
                            id:passives[i],
                            rank:Math.floor(Math.random() * 5)
                        })
                    }
                    boss = simulateCPUAbilityAssign(boss,[],10 + (townData.level * 1.25))
                    boss = simulateCPUSPAssign(clone(boss),townData.level * 60)

                    let highestStat;
                    let highestVal = 0
                    for(s in boss.stats){
                        let value = boss.stats[s]

                        if(value > highestVal){
                            highestStat = s
                            highestVal = value
                        }
                    }

                    boss.highestStat = highestStat

                    townData.raid = {
                        leader:{
                            name:boss.name,
                            unit:boss,
                            equipment:bossEquipment
                        },
                        missions:missions
                    }
                    
                    let raidableFacilities = ["armory","market","tasks"]
                    raidableFacilities.splice(Math.floor(Math.random() * raidableFacilities.length),1)

                    townData.raid.raidedFacilities = raidableFacilities
                }

                //Restock Tasks
                if(townData.taskRestock < now.getTime()){
                    townData.taskRestock = now.getTime() + 86400000
                    townData.taskList = []
                    while(townData.taskList.length < 3){
                        let newTask = data.townTasks[Math.floor(Math.random() * data.townTasks.length)]
                        let repeat = false;
                        for(task of townData.taskList){
                            if(task.name == newTask.name){
                                repeat = true
                                break;
                            }
                        }
                        while(repeat){
                            repeat = false
                            newTask = data.townTasks[Math.floor(Math.random() * data.townTasks.length)]
                            for(task of townData.taskList){
                                if(task.name == newTask.name){
                                    repeat = true
                                    break;
                                }
                            }
                        }
                        townData.taskList.push(newTask)
                    }
                }


                //Restock Market / Armory
                if(townData.marketRestock < now.getTime()){
                    // Market
                    let regionStatKey = {
                        "Swamp":"hp",
                        "Tundra":"atk",
                        "Desert":"def",
                        "Islands":"spatk",
                        "Mountains":"spdef",
                        "Forest":"spd"
                    }

                    townData.marketRestock = now.getTime() + 86400000
                    townData.listings = []
                    for(var i = 0; i < 6;i++){
                        let val = 0.75 + (Math.random() * 0.5)
                        let newData = {
                            ref:{
                                type: "rngEquipment",
                                rngEquipment: {
                                    scaling: false,
                                    value:1,
                                    conStats:1,
                                    conValue:0.8,
                                    lockStatTypes: true,
                                    baseVal: Math.ceil(val * 10 * townData.level),
                                    types: i % 2 == 0 ? ["weapon"] : ["gear"],
                                }
                            }
                        }
                    
                        let item = generateRNGEquipment(newData)
                        for(r of townData.regions){
                            if(item.stats[regionStatKey[r]] < 0){
                                item.stats[regionStatKey[r]] = Math.ceil(item.stats[regionStatKey[r]] * 0.75)
                            } else {
                                item.stats[regionStatKey[r]] = Math.ceil(item.stats[regionStatKey[r]] * 1.25)
                            }
                        }
                        item.name = generateEquipmentName(item)
                        townData.listings.push([item,Math.ceil(2 * val * Math.pow(townData.level,Math.log10(40)) * 350)])
                    }

                    // Armory
                    townData.armorylistings = {
                        ability:[],
                        equipment:[]
                    }

                    let equipmentUpgrades = [
                        ["hp",1.5],
                        ["atk",0.4],
                        ["def",0.9],
                        ["spatk",0.4],
                        ["spdef",0.9],
                        ["spd",0.75],
                        ["baseAtk","p",1.2],
                        ["baseSpAtk","p",1.2],
                        ["baseDef","p",1.4],
                        ["baseSpDef","p",1.4]
                    ]

                    let abilityUpgrades = {
                        attack:[
                            "critical",
                            "damage_val",
                            "speed",
                            "numHits",
                            "recoil",
                            "accuracy"
                        ],
                        guard:[
                            "guard_val",
                            "success_level",
                            "counter_val"
                        ],
                        stats:[
                            "speed",
                            "focus"
                        ]
                    }

                    for(var i = 0; i < 5; i++){
                        let index = Math.floor(Math.random() * equipmentUpgrades.length)
                        let upgrade = equipmentUpgrades[index]
                        let upgradeData = {
                            stat:upgrade[0],
                            multi:upgrade[1],
                            roll:Math.ceil(Math.random() * 5)
                        }
                        if(upgrade[1] == "p"){
                            upgradeData.pow = true
                            upgradeData.multi = upgrade[2]
                        }
                        townData.armorylistings.equipment.push(upgradeData)
                        equipmentUpgrades.splice(index,1)
                    }

                    for(var i = 0; i <5; i++){
                        let type = ["attack","guard","stats"][i % 3]
                        let index = Math.floor(Math.random() * abilityUpgrades[type].length)
                        let upgrade = abilityUpgrades[type]
                        townData.armorylistings.ability.push({
                            type:type,
                            stat:abilityUpgrades[type][index],
                            roll:Math.ceil(Math.random() * 5)
                        })
                        abilityUpgrades[type].splice(index,1)
                    }

                    
                }

                //Restock Training
                if(townData.trainingRestock < now.getTime()){
                    townData.trainingRestock = now.getTime() + 86400000
                    townData.availableAbilities = []
                    let inVal = 100 * (townData.level + 1.125)
                    for(var i = 0; i < 6;i++){
                        let newData = {
                            baseVal: inVal,
                            forceType: ["attack","guard","stats"][i % 3],
                            forceStats: false
                        }
                        let ability = generateRNGAbility(newData)
                        let ratio = calculateAbilityCost(ability)/inVal
                        console.log(ratio)
                        townData.availableAbilities.push([ability,Math.ceil(500 * ratio * Math.pow(townData.level,1.43775056282))])
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
                        if(chatLog && chatLog[expedition.playerID]){
                            active = chatLog[expedition.playerID]
                        } else {
                            active = false
                        }

                        let stepResult = runExpeditionStep(expedition,active,townData,players[expedition.playerID])
                        if(stepResult){
                            const expeditionIndex = i;
                            players[expedition.playerID] = stepResult[1]
                            client.guilds.fetch(town).then(guild =>{
                                guild.members.fetch(stepResult[1].id)
                                .then(member =>{ 
                                    member.createDM().then(dm =>{
                                        const embed = new MessageEmbed()
                                        .setColor('#00ff00')
                                        .setTitle("Expedition Event")

                                        embed.addField("---",stepResult[0])
                                        dm.send({embeds:[embed]}).catch((e) =>{})
                                    })
                                }).catch(error =>{
                                    updateTownDBData(guild.id,"expeditions/" + expeditionIndex,null,function(){
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
}

setInterval(() => {
    botUpdate()
}, 300000);


process.on('unhandledRejection', error => {
	console.error('Unhandled promise rejection:', error);
});

// process.on('SIGINT', () => {
//     client.channels.fetch("1232765826231308419").then(channel =>{
//         const embed = new MessageEmbed()

//         embed.addFields(
//             { name: 'MANUAL BOT RESET', value: "Time of reset: " + new Date().toString() + "\n\nPlayer sessions have been cleared, apologies for the inconvenience" }
//         )

//         channel.send({
//             content:" ",
//             embeds:[embed]
//         }).then(() => {
//             process.exit()
//         })
//     })
// })

// process.on('SIGHUP', function () {
//     client.channels.fetch("1232765826231308419").then(channel =>{
//         const embed = new MessageEmbed()

//         embed.addFields(
//             { name: 'MANUAL BOT RESET', value: "Time of reset: " + new Date().toString() + "\n\nPlayer sessions have been cleared, apologies for the inconvenience" }
//         )

//         channel.send({
//             content:" ",
//             embeds:[embed]
//         }).then(() => {
//             process.exit()
//         })
//     })
// })

client.login(token);