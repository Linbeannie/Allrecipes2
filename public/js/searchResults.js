//---------------event listeners---------------

$(".recipe").on("click", displayRecipeInfo);
$(".deleteRecipe").on("click", confirmDeleteRecipe);

//---------------functions---------------

//confirm recipe deletion
function confirmDeleteRecipe(){
  let deleteRecipe = confirm(`Delete recipe ${$(this).next().html()}?`);

  if(deleteRecipe) {
    let recipeId = $(this).attr("id");
    //alert("deleting record...");

    window.location.href = `/deleteRecipe?recipeId=${recipeId}`;

  }
}

//display recipe info in modal
async function displayRecipeInfo() {
  //alert( $(this).attr("id") );
  let recipeId = $(this).attr("id");
  
  let url = `https://allrecipes2-final-project.linmcafe.repl.co//recipes/${recipeId}`;

  let response = await fetch(url);
  let data = await response.json(); 
  let recipe = data[0];

  $("#recipeInfo").html("");
  $("#recipeInfo").html(`<h4>${recipe.name}</h4>`);
  $('#recipeInfo').append(`<img style= "width: 480px" src= "${recipe.photo}"/>`);
  $('#recipeInfo').append(`<h5> <em>Category</em>: ${recipe.category} </h5><br>`);
  $('#recipeInfo').append(`<h5> <em>Preparation Time</em>: ${recipe.time} minutes</h5><br>`);
  $('#recipeInfo').append(`<h5> <em>Ingredients</em>: ${recipe.ingredients} </h5><br>`);
  $('#recipeInfo').append(`<h5> <em>Directions</em>: ${recipe.directions} </h5><br>`);
  $('#recipeInfo').append(`<h6> <em>Author</em>: ${recipe.author}</h6>`);
  $('#recipeModal').modal("show"); //launches the modal

}
