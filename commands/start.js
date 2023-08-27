const { SlashCommandBuilder } = require('@discordjs/builders');
const { populateQuestConsole } = require("../sessionTools.js")
const { getPotentialData, updatePotentialData } = require("../firebaseTools.js")
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
            getPotentialData(function(potential){
                let bonus = 0
                let userPotential = potential[interaction.user.id]
                if(userPotential && userPotential.count > 15){
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
                        player:templates.emptyPlayerData
                    }
                }
                console.log(bonus)
                if(bonus >= 15){
                    newSession.session_data.player.level = 5
                    newSession.session_data.player.abilitypoints = bonus
                    newSession.session_data.player.statpoints = 15
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
            interaction.reply({ content: 'You already have an account', ephemeral: true });
        }
        
	},
};