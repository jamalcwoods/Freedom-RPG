const { MessageEmbed } = require('discord.js');
const { populateTownVisitWindow, populateTownVisitControls } = require('../sessionTools.js')
const executeProfile = require("../commands/profile.js").execute;
const executeWild = require("../commands/explore.js").execute;
const executeChallenges = require("../commands/challenges.js").execute;

function getUserSession(sessions,user){
    for(session of sessions){
        if(session.user_ids.includes(user.id)){
            return session
        }
    }
    return null
}

module.exports = {
    config:{
        getPlayerData:true,
        getGuildTown:true,
        getSessions:true
    },
    data:{
        name:"dailySelection"
    },
    execute(interaction,componentConfig,callback){
        let playerData = componentConfig.playerData
        let townData = componentConfig.townData
        let id = componentConfig.args[0]
        let sessions = componentConfig.sessions
        if(id == interaction.user.id){
            if(getUserSession(sessions,interaction.user) == null){
                switch(interaction.values[0]){
                    case "profile":
                        componentConfig.choices = [
                            {
                                member:interaction.member,
                                value:interaction.member.user.id
                            }
                            ,{
                                value:"stats"
                            }
                        ] 
                        componentConfig.forceUpdateInteraction = true
                        executeProfile(interaction,componentConfig,callback)
                        break;

                    case "explore":
                        componentConfig.choices = [{value: "wild"}]
                        componentConfig.forceUpdateInteraction = true
                        executeWild(interaction,componentConfig,callback)
                        break;

                    case "challenges":
                        componentConfig.forceUpdateInteraction = true
                        executeChallenges(interaction,componentConfig,callback)
                        break;

                    case "rewards":
                        const embed = new MessageEmbed()
                        embed.setColor("#7289da")
                        embed.addField("Rewards",playerData.dailyText)

                        interaction.reply({
                            content: ' ',
                            embeds:[embed],
                            ephemeral:true
                        })
                        break;

                    case "militia":
                        playerData.exploreStreak = 0

                        let newSession = {
                            type:"townVisit",
                            session_id: Math.floor(Math.random() * 100000),
                            user_ids:[playerData.id],
                            session_data:{
                                player:playerData,
                                town:townData,
                                location:"defense"
                            }
                        }
                
                        let updates = []
                        updates.push({
                            id:playerData.id,
                            path:"exploreStreak",
                            value:0
                        })
                        
                        interaction.update({
                                content: " ",
                                embeds: populateTownVisitWindow(newSession),
                                components: populateTownVisitControls(newSession)
                        })
                        callback({
                            addSession:newSession,
                            updatePlayer:updates
                        })
                        break;
                }
            } else {
                interaction.reply({content: "The daily window was closed as you are already in another session",ephemeral:true})
                interaction.message.delete()
            }
        } 
    }
}