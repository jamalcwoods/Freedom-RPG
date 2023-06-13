const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageActionRow, MessageSelectMenu, MessageButton, MessageEmbed } = require('discord.js');
const { populateDungeonEvent, populateCombatControls, populateCombatWindow, populateConformationControls, populateConformationWindow, populateTownVisitWindow, populateTownVisitControls, populateStatEditButtons, populateStatEditWindow, populateQuestConsole, populateLobbyWindow, populateLobbyControls, populateInventoryControls, populateInventoryWindow, populateManegeAbilityWindow, populateManageAbilityControls, populateAbilityCreatorWindow, populateAbilityCreatorButtons} = require('../sessionTools');

function populateRelocate(session, interaction, callback){
    if(session == undefined){
        const embed = new MessageEmbed()
        .setColor("#7289da")
        .setTitle("No Session Found")

        return {
            content: " ",
            embeds: [embed]
        }
    } else {
        const embed = new MessageEmbed()
        .setColor("#7289da")
 
        switch(session.type){
            case "dungeon":
                populateDungeonEvent(session,interaction,callback,true)
                break;
            case "combat":
                interaction.reply({
                    content:" ",
                    components:populateCombatControls(session),
                    embeds:populateCombatWindow(session)
                })
                break;
            case "startExpedition":
                interaction.reply({
                    content: " ",
                    embeds: populateConformationWindow(session),
                    components: populateConformationControls(session),
                    ephemeral: true
                })
                break;
            case "startDungeon":
                interaction.reply({
                    content: " ",
                    embeds: populateConformationWindow(session),
                    components: populateConformationControls(session),
                    ephemeral: true
                })
                break;
            case "townVisit":
                interaction.reply({
                    content: " ",
                    embeds: populateTownVisitWindow(session),
                    components: populateTownVisitControls(session)
                })
                break;
            case "stats":
                interaction.reply({
                    content: " ",
                    components: populateStatEditButtons(session),
                    embeds: populateStatEditWindow(session)
                })
                break;
            case "quest":
                interaction.reply(populateQuestConsole(session))
                break;
            case "lobby":
                interaction.reply({
                    content: populateLobbyWindow(session),
                    components: populateLobbyControls(session),
                    fetchReply:true
                }).then((message) =>{
                    session.session_data.m_id = message.id
                    session.session_data.c_id = message.channelId
                })
                break;
            case "inventory":
                interaction.reply({
                    content: " ",
                    components: populateInventoryControls(session),
                    embeds: populateInventoryWindow(session)
                })
                break;
            case "manageAbilities":
                interaction.reply({
                    content:" ",
                    embeds:populateManegeAbilityWindow(session),
                    components:populateManageAbilityControls(session) 
                })
                break;
            case "makeAbility":
                interaction.reply({
                    content: " ",
                    components: populateAbilityCreatorButtons(session),
                    embeds: populateAbilityCreatorWindow(session)
            })
                break;
        }   
        
        return {
            content: " ",
            embeds: [embed]
        }
    }
}

module.exports = {
	data: new SlashCommandBuilder()
		.setName('relocate')
		.setDescription('Relocate a session window'),
    config:{
        getPlayerData:true,
        getSessions:true,
        sessionCommand:true
    },
    async execute(interaction,componentConfig,callback) {
        let playerData = componentConfig.playerData
        let sessions = componentConfig.sessions
        if(sessions.length == 0){
            interaction.reply(populateRelocate(undefined))
            callback({})
        } else {
            let playerSession;
            for(session of sessions){
                if(session.user_ids.includes(playerData.id) && !session.session_data.onHold){
                    playerSession = session
                    break;
                }
            }
            populateRelocate(playerSession,interaction,callback)
            callback({})
        }
    }
};