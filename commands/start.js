const { SlashCommandBuilder } = require('@discordjs/builders');
const { populateQuestConsole } = require("../sessionTools.js")
const { getPotentialData, updatePotentialData } = require("../firebaseTools.js")
const { templates } = require ("../data.json")
const { clone } = require ("../tools.js")


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
            getPotentialData(function(potential){
                let bonus = 0
                let userPotential = potential[interaction.user.id]
                if(userPotential && userPotential.count > 25){
                    bonus = userPotential.count
                }
                let newSession = {
                    type:"quest",
                    session_id: Math.floor(Math.random() * 100000),
                    user_ids:[interaction.user.id],
                    session_data:{
                        quest_id:0,
                        quest:{},
                        questStep:0,
                        player:clone(templates.emptyPlayerData)
                    }
                }
                if(bonus >= 25){
                    newSession.session_data.player.statpoints += bonus
                }
                newSession.session_data.player.id = interaction.user.id
                newSession.session_data.player.name = interaction.user.username
                
                interaction.reply(populateQuestConsole(newSession))
                
                callback({
                    addSession:newSession
                })
                potential[interaction.user.id] = null
                updatePotentialData(potential)
            })
        } else {
            interaction.reply({ content: 'You already have an account. If you are not sure what to do next, try the `/tutorial` command', ephemeral: true });
        }
        
	},
};