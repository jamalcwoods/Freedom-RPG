const { SlashCommandBuilder } = require('@discordjs/builders');
const { populateStatEditWindow, populateStatEditButtons } = require("../sessionTools.js")
const { clone } = require("../tools.js")


module.exports = {

	data: new SlashCommandBuilder()
		.setName('stats')
		.setDescription('Customize Your Characters Stats'),
    config:{
        getPlayerData:true
    },
	async execute(interaction,componentConfig,callback) {
        let playerData = componentConfig.playerData
        let newSession = {
            type:"stats",
            session_id: Math.floor(Math.random() * 100000),
            user_ids:[playerData.id],
            session_data:{
                faction:playerData.faction,
                statpoints:playerData.statpoints,
                level:playerData.level,
                stats:clone(playerData.stats),
                prevStats:playerData.stats,
                editingStat:"none"
            }
        }
        
        interaction.reply({
                content: populateStatEditWindow(newSession),
                components: populateStatEditButtons(newSession),
                embeds: []
        })
        callback({
            addSession:newSession
        })
	},
};