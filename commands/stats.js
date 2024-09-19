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
                editAmount:1,
                editingStat:"none"
            }
        }
        
        if(playerData.tutorial == 2){
            newSession.session_data.tutorial = true
            interaction.reply({
                content: "From this menu you can spend skill points to increase and decrease your character's stats.\nTo start off, you need to have at least 10 points in HP, DEF, SPDEF, and at least 10 points in either ATK or SPATK\nThe remaining points can be spent however you like\n\nOnce you are done adjusting your stats, press the 'Save' button and then do the `/tutorial` command",
                components: populateStatEditButtons(newSession),
                embeds: populateStatEditWindow(newSession)
        })
        } else {
            interaction.reply({
                content: " ",
                components: populateStatEditButtons(newSession),
                embeds: populateStatEditWindow(newSession)
        })
        }
        
        callback({
            addSession:newSession
        })
	},
};