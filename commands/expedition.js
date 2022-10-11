const { SlashCommandBuilder } = require('@discordjs/builders');
const { populateConformationControls, populateConformationWindow } = require("../sessionTools.js")


module.exports = {

	data: new SlashCommandBuilder()
		.setName('expedition')
		.setDescription('Send your character on an idle expedition'),
    config:{
        getPlayerData:true,
        getGuildTown:true
    },
	async execute(interaction,componentConfig,callback) {
        let playerData = componentConfig.playerData
        let townData = componentConfig.townData

        let newSession = {
            type:"startExpedition",
            session_id: Math.floor(Math.random() * 100000),
            user_ids:[playerData.id],
            session_data:{
                player:playerData,
                town:townData
            }
        }
        
        interaction.reply({
            content: " ",
            embeds: populateConformationWindow(newSession),
            components: populateConformationControls(newSession),
            ephemeral: true
        })

        callback({
            addSession:newSession
        })
	},
};