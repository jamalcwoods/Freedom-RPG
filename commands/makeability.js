const { SlashCommandBuilder } = require('@discordjs/builders');
const { populateAbilityCreatorButtons, populateAbilityCreatorWindow } = require("../sessionTools.js")
const { clone } = require("../tools.js")
const data = require("../data.json")


module.exports = {

	data: new SlashCommandBuilder()
		.setName('makeability')
		.setDescription('Create a new ability for your character to learn'),
    config:{
        getPlayerData:true
    },
	async execute(interaction,componentConfig,callback) {
        let playerData = componentConfig.playerData
        if(!playerData.abilities){
            playerData.abilities = []
        }
        if(playerData.abilities.length < 6){
            let newSession = {
                type:"makeAbility",
                session_id: Math.floor(Math.random() * 100000),
                user_ids:[playerData.id],
                session_data:{
                    abilities:playerData.abilities,
                    ability:data.templates.attack,
                    faction:playerData.faction,
                    skillpoints:playerData.skillpoints,
                    level:playerData.level,
                    permissions:playerData.abilityPermissions,
                    editingAttribute:"action_type"
                }
            }
            
            interaction.reply({
                    content: populateAbilityCreatorWindow(newSession),
                    components: populateAbilityCreatorButtons(newSession),
                    embeds: [],
                    ephemeral: true,
            })
            callback({
                addSession:newSession
            })
        } else {
            interaction.reply({ content: 'You already have the maximum number of abilties!', ephemeral: true });
            callback({})
        }
	},
};