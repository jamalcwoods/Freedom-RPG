const { SlashCommandBuilder } = require('@discordjs/builders');
const { populateQuestConsole } = require("../sessionTools.js")
const { templates } = require ("../data.json")


module.exports = {

	data: new SlashCommandBuilder()
		.setName('start')
		.setDescription('Begin your journey'),
    config:{
      getPlayerData:true,
      newPlayer:true  
    },
	async execute(interaction,config,callback) {
        if(!config.playerData){
            let newSession = {
                type:"quest",
                session_id: Math.floor(Math.random() * 100000),
                user_ids:[interaction.user.id],
                session_data:{
                    quest_id:0,
                    quest:{},
                    questStep:0,
                    player:templates.emptyPlayerData
                }
            }
            newSession.session_data.player.id = interaction.user.id
            newSession.session_data.player.name = interaction.user.username
            
            interaction.reply(populateQuestConsole(newSession))
            callback({
                addSession:newSession
            })
        } else {
            interaction.reply({ content: 'You already have an account', ephemeral: true });
        }
        
	},
};