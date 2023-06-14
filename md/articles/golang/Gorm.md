# gorm many2many

## [GORM API](https://gorm.io/docs/query.html)

```
package main

import (
	"fmt"

	"github.com/jinzhu/gorm"
	_ "github.com/jinzhu/gorm/dialects/postgres"
)

type User struct {
	Id        int `json:"id" gorm:"primary_key"`
	Name      string
	Languages []Language `gorm:"many2many:user_languages;association_autoupdate:false;association_autocreate:false"`
}

type Language struct {
	Id   int    `json:"id" gorm:"primary_key"`
	Name string `json:"name" gorm:"unique" validate:"required"`
}

func main() {
	// Connection is the connection string
	connection := "host=localhost port=5432 user=kong dbname=gorm-test password=kong sslmode=disable"
	db, _ := gorm.Open("postgres", connection)
	db.LogMode(true)
	db.AutoMigrate(&User{}, &Language{})

	// DemoLanguageCreate(db)
	// DemoUserCreate(db)

	// DemoGetLanguageUsers(db)
	// DemoGetUserLanguages(db)

	DemoGetLanguagesUsers(db)

	// ps.db.Model(&model.User{
	// 	Id:        9,
	// 	Name:      "test1",
	// 	Languages: languages,
	// }).Association("Languages").Find(&languages)
	// fmt.Println(Language)

}

func DemoLanguageCreate(db *gorm.DB) {
	db.Create(&Language{
		Id:   5,
		Name: "cn5",
	})
}

func DemoUserCreate(db *gorm.DB) {
	languages := []Language{}

	// languages = append(languages, Language{Id: 1, Name: "cn1"})
	// languages = append(languages, Language{Id: 2, Name: "cn2"})
	languages = append(languages, Language{Id: 3, Name: "cn3"})
	languages = append(languages, Language{Id: 4, Name: "cn4"})

	db.Create(&User{
		Id:        3,
		Name:      "test3",
		Languages: languages,
	})
}

func DemoGetLanguagesUsers(db *gorm.DB) {
	users := []User{}

	languageIds := []int{}
	// languageIds = append(languageIds, 1)
	// languageIds = append(languageIds, 2)
	languageIds = append(languageIds, 3)

	db.Preload("Languages").Model(&User{}).Where("id IN (?)", db.Table("user_languages").Select("user_id").Where("language_id IN (?)", languageIds).QueryExpr()).Find(&users)

	fmt.Println(users)
}

func DemoGetLanguageUsers(db *gorm.DB) {
	var users []User
	db.Model(&Language{Id: 1}).Related(&users, "Users")
	fmt.Println(users)
}

func DemoGetUserLanguages(db *gorm.DB) {
	var languages []Language
	// db.Model(&User{Id: 1}).Offset(1).Limit(1).Related(&languages, "Languages")
	db.Model(&User{Id: 1}).Offset(0).Limit(2).Related(&languages, "Languages")
	fmt.Println(languages)
}

func DemoAssociationOperate(db *gorm.DB) {
	// languages := []Language{}

	// languages = append(languages, Language{Id: 1, Name: "cn1"})
	// languages = append(languages, Language{Id: 2, Name: "cn2"})
	// languages = append(languages, Language{Id: 3, Name: "cn3"})
	// languages = append(languages, Language{Id: 4, Name: "cn4"})

	// 更新 更新关联关系，删除+新增
	// ps.db.Save(&User{
	// 	Id:        9,
	// 	Name:      "test11",
	// 	Languages: languages,
	// }).Association("languages").Replace(languages)

	// 追加关联表 关联关系 新增
	// ps.db.Model(&User{
	// 	Id:        9,
	// 	Name:      "test1",
	// 	Languages: languages,
	// }).Association("languages").Append(languages)

	// 清理 所有关联 删除
	// ps.db.Model(&User{
	// 	Id:        9,
	// 	Name:      "test1",
	// 	Languages: languages,
	// }).Association("languages").Clear()

	// 更新关联关系，删除+新增
	// db.Model(&User{
	// 	Id:        9,
	// 	Name:      "test1",
	// 	Languages: languages,
	// }).Association("languages").Replace(languages)
}
```