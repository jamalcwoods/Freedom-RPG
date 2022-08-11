const { SlashCommandBuilder } = require('@discordjs/builders');
const { populateTownVisitWindow, populateTownVisitControls } = require("../sessionTools.js")



module.exports = {

	data: new SlashCommandBuilder()
		.setName('town')
		.setDescription("Visit a part of this server's town"),
    config:{
        getPlayerData:true,
        getGuildTown:true
    },
	async execute(interaction,componentConfig,callback) {
        let playerData = componentConfig.playerData
        let townData = componentConfig.townData

        let newSession = {
            type:"townVisit",
            session_id: Math.floor(Math.random() * 100000),
            user_ids:[playerData.id],
            session_data:{
                player:playerData,
                town:townData,
                location:null
            }
        }
        
        interaction.reply({
                content: " ",
                embeds: populateTownVisitWindow(newSession),
                components: populateTownVisitControls(newSession)
        })
        callback({
            addSession:newSession
        })
	}
};