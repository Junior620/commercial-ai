

## CAHIER DES CHARGES
Agent IA de
## Prospection
## Commerciale
Produits Cacao, Beurre de Cacao
et Derives
## DOCUMENT
Specifications fonctionnelles
et architecture technique
## STATUT
## Version 1.0 — Avril 2026
## CONFIDENTIEL
Usage interne
uniquement

CAHIER DES CHARGES — AGENT IA PROSPECTION COMMERCIALEConfidentiel
Agent IA Prospection — Cacao & DerivesPage 2Avril 2026
Table des matieres
- Contexte du projet
- Objectifs du projet
- Perimetre fonctionnel
3.1 Gestion des prospects
3.2 Segmentation commerciale
3.3 Generation de mails par IA
3.4 Envoi de campagnes
3.5 Relances automatiques
3.6 Gestion des reponses
3.7 Tableau de bord
- Utilisateurs et roles
- Exigences fonctionnelles
## 5.1 Administration
## 5.2 Campagnes
5.3 IA commerciale
5.4 Suivi CRM
- Exigences non fonctionnelles
- Contraintes et regles metier
- Livrables attendus
- Architecture technique
- Modules techniques

CAHIER DES CHARGES — AGENT IA PROSPECTION COMMERCIALEConfidentiel
Agent IA Prospection — Cacao & DerivesPage 3Avril 2026
## 1CONTEXTE DU PROJET
L'entreprise   souhaite   moderniser   et   automatiser   une   partie   significative   de   sa   prospection
commerciale  par  email,  dans  le  but  de  contacter  un  grand  nombre  de  prospects  qualifies  operant
dans le secteur du cacao et de ses derives (beurre de cacao, poudre de cacao, chocolat industriel,
matieres grasses vegetales, etc.).
Il ne s'agit en aucun cas de mettre en place un dispositif de spam massif. L'ambition est de deployer
un systeme intelligent, pilote par l'intelligence artificielle, capable de gerer l'ensemble du cycle de
prospection avec finesse et pertinence, depuis la gestion de la base de contacts jusqu'au suivi des
conversions.
Le systeme devra notamment etre capable de :
•Gerer et enrichir une base de prospects qualifies
•Segmenter les contacts selon leur profil, activite et zone geographique
•Generer des emails commerciaux personnalises grace a l'IA
•Envoyer les messages de maniere controlee et progressive
•Assurer le suivi des reponses et declencher des relances intelligentes
•Produire un tableau de bord commercial complet

CAHIER DES CHARGES — AGENT IA PROSPECTION COMMERCIALEConfidentiel
Agent IA Prospection — Cacao & DerivesPage 4Avril 2026
## 2OBJECTIFS DU PROJET
Ce projet vise a mettre en place une plateforme complete de prospection commerciale assistee par
intelligence artificielle. Les objectifs strategiques sont les suivants :
ObjectifDescription
Import & gestionImporter et gerer une base de contacts commerciaux structuree
SegmentationClasser les prospects selon leur activite, produit cible et priorite
Generation IAUtiliser l'IA pour rediger des emails adaptes a chaque segment
AutomatisationAutomatiser l'envoi initial et les sequences de relances
Analyse reponsesDetecter et classifier les reponses (positives, negatives, neutres)
PerformanceSuivre les performances des campagnes en temps reel
ConversionAmeliorer significativement le taux de reponse et de conversion

CAHIER DES CHARGES — AGENT IA PROSPECTION COMMERCIALEConfidentiel
Agent IA Prospection — Cacao & DerivesPage 5Avril 2026
## 3PERIMETRE FONCTIONNEL
Le systeme couvre un ensemble de fonctionnalites organisees en sept blocs fonctionnels majeurs,
chacun jouant un role cle dans la chaine de prospection commerciale.
3.1  Gestion des prospects
Le module de gestion des prospects constitue le socle du systeme. Il permet d'alimenter la base de
donnees, d'assurer la qualite des informations et de maintenir un referentiel de contacts fiable et a
jour.
Fonctionnalites principales :
•Import de fichiers Excel (.xlsx) ou CSV
•Saisie manuelle de prospects avec formulaire structure
•Modification et suppression de fiches prospects
•Detection automatique des doublons (par email, nom d'entreprise)
•Validation du format des adresses email
Champs minimaux d'un prospect :
ChampDescriptionObligatoire
EntrepriseRaison sociale du prospectOui
ContactNom et prenom du correspondantOui
EmailAdresse email professionnelleOui
TelephoneNumero de telephoneNon
PaysPays d'implantationOui
SecteurSecteur d'activite (agroalim., cosmetique...)Oui
Type clientImportateur, distributeur, industriel...Oui
ProduitProduit d'interet principalNon
StatutStatut commercial (nouveau, en cours, converti)Oui
Dernier contactDate du dernier echangeAuto
NotesNotes internes libresNon

CAHIER DES CHARGES — AGENT IA PROSPECTION COMMERCIALEConfidentiel
Agent IA Prospection — Cacao & DerivesPage 6Avril 2026
3.2  Segmentation commerciale
La segmentation permet de regrouper les prospects selon des criteres pertinents afin d'adapter la
communication commerciale a chaque cible. Un bon ciblage est la cle d'un taux de reponse eleve.
Criteres de segmentation :
•Type d'activite (chocolatier, importateur, distributeur, trader...)
•Pays ou zone geographique (Afrique, Europe, Ameriques, Asie)
•Categorie produit d'interet (cacao, beurre de cacao, poudre, derives)
•Niveau de priorite (haute, moyenne, basse)
•Langue du contact (francais, anglais, espagnol, etc.)
•Historique d'interaction (nouveau, contacte, en discussion, converti)
Exemples de segments types :
3 Industriels agroalimentaires3 Chocolatiers artisanaux
3 Importateurs matieres premieres3 Distributeurs specialises
3 Industriels cosmetiques3 Traders matieres premieres
3.3  Generation de mails commerciaux par IA
C'est le coeur du systeme. Le moteur d'intelligence artificielle genere automatiquement des emails
commerciaux personnalises en s'appuyant sur le profil du prospect, le produit cible, le ton souhaite
et  la  langue  du  destinataire.  L'objectif  est  de  produire  des  messages  qui  paraissent  naturels,
professionnels et pertinents pour chaque interlocuteur.
Parametres d'entree de l'IA :
•Profil complet du prospect (secteur, pays, produit d'interet)
•Produit ou gamme ciblee par la campagne
•Ton commercial defini (formel, amical, technique, premium)
•Langue choisie pour la redaction
•Objectifs specifiques de la campagne (prise de contact, relance, offre speciale)
Structure du mail genere :
ElementDescription
ObjetLigne d'objet accrocheuse et personnalisee
SalutationFormule adaptee au contexte culturel
IntroductionAccroche personnalisee mentionnant le prospect
PropositionPresentation de l'offre ou du produit

CAHIER DES CHARGES — AGENT IA PROSPECTION COMMERCIALEConfidentiel
Agent IA Prospection — Cacao & DerivesPage 7Avril 2026
ArgumentsPoints forts du produit ou service
Appel a l'actionInvitation claire (rendez-vous, demande d'info, etc.)
SignatureSignature professionnelle configurable
Controle utilisateur :
L'utilisateur  conserve  un  controle  total  sur  les  emails  generes.  Il  peut  previsualiser  chaque
message,  le  modifier  manuellement,  valider  avant  l'envoi  et  enregistrer  des  modeles  reutilisables
pour les campagnes futures.

CAHIER DES CHARGES — AGENT IA PROSPECTION COMMERCIALEConfidentiel
Agent IA Prospection — Cacao & DerivesPage 8Avril 2026
3.4  Envoi de campagnes
Le module d'envoi gere la diffusion des emails de maniere progressive et maitrisee, dans le respect
des  bonnes  pratiques  de  delivrabilite.  Il  offre  une  flexibilite  complete  dans  la  gestion  des
campagnes.
•Envoi unitaire (email individuel) pour les cas particuliers
•Envoi par lot avec controle du volume
•Planification des envois (date et heure programmees)
•Limitation du nombre d'emails par jour pour preserver la reputation du domaine
•Gestion simultanee de plusieurs campagnes
•Possibilite de suspendre et reprendre une campagne en cours
3.5  Relances automatiques
Le systeme de relances intelligentes permet de maximiser les chances d'obtenir une reponse sans
pour  autant  importuner  le  prospect.  Les  relances  sont  declenchees  automatiquement  selon  un
calendrier predefined, avec un contenu varie pour eviter la repetition.
•Envoi automatique de relances si aucune reponse n'est recue
•Delai configurable entre chaque relance (ex : J+4, J+8)
•Nombre maximum de relances paramtrable
•Arret immediat des relances des qu'une reponse est detectee
•Variation du contenu de chaque relance par l'IA
Exemple de sequence type :
## J+0
Envoi initial
## J+4
## Relance 1
## J+8
## Relance 2
## Stop
Si reponse

CAHIER DES CHARGES — AGENT IA PROSPECTION COMMERCIALEConfidentiel
Agent IA Prospection — Cacao & DerivesPage 9Avril 2026
3.6  Gestion des reponses
Le  systeme  analyse  les  reponses  entrantes  et  les  classifie  automatiquement  afin  de  faciliter  le
traitement par l'equipe commerciale. L'IA peut egalement proposer un brouillon de reponse adapte.
Classification automatique des reponses :
CategorieAction suggeree
Reponse positiveTransfert au commercial pour suivi prioritaire
Demande d'informationsEnvoi de documentation produit
Demande de prixPreparation d'un devis personnalise
Demande de rendez-vousPlanification d'un appel ou visite
Reponse negativeArchivage et recontact ulterieur
Absence d'interetPassage en statut froid
DesabonnementRetrait immediat de la liste d'envoi
3.7  Tableau de bord
Le  tableau  de  bord  offre  une  vision  synthetique  des  performances  commerciales.  Il  permet  a  la
direction   et   aux   equipes   de   suivre   l'efficacite   des   campagnes   et   d'ajuster   la   strategie   en
consequence.
Indicateurs cles de performance (KPI) :
3 Nombre de prospects importes3 Nombre de mails envoyes / delivres
3 Taux d'ouverture des emails3 Nombre de clics
3 Nombre et taux de reponses3 Taux de conversion global
3 Nombre de prospects chauds3 Performance par produit
3 Performance par pays3 Performance par segment

CAHIER DES CHARGES — AGENT IA PROSPECTION COMMERCIALEConfidentiel
Agent IA Prospection — Cacao & DerivesPage 10Avril 2026
## 4UTILISATEURS ET ROLES
Le  systeme  est  concu  pour  etre  utilise  par  differents  profils  au  sein  de  l'organisation,  chacun
disposant de droits et fonctionnalites adaptes a son role.
RoleResponsabilites principales
## Administrateur
Configuration du systeme, gestion des utilisateurs,
parametrage des comptes emails et modeles
Responsable commercial
Creation et pilotage des campagnes, choix des segments,
suivi des resultats et prises de decisions
Assistant commercial
Gestion quotidienne des prospects, verification des
emails generes, traitement des reponses
## Direction
Consultation du tableau de bord, analyse des
performances globales, decisions strategiques

CAHIER DES CHARGES — AGENT IA PROSPECTION COMMERCIALEConfidentiel
Agent IA Prospection — Cacao & DerivesPage 11Avril 2026
## 5EXIGENCES FONCTIONNELLES
## 5.1  Administration
L'administrateur dispose d'un acces complet a la configuration du systeme. Il peut notamment :
•Creer et gerer les comptes utilisateurs
•Definir et attribuer les roles et permissions
•Configurer les parametres globaux du systeme
•Parametrer les comptes emails expediteurs (SMTP, API)
•Definir les signatures et modeles d'emails par defaut
## 5.2  Campagnes
Le responsable commercial pilote l'ensemble du processus de campagne :
•Creer une nouvelle campagne avec un objectif defini
•Selectionner un segment de prospects cible
•Choisir le produit ou la gamme a promouvoir
•Definir la langue et le ton commercial souhaites
•Lancer l'envoi et suivre les resultats en temps reel
5.3  IA commerciale
L'agent IA est au coeur du dispositif. Il doit etre capable de :
•Proposer un angle commercial adapte a chaque segment
•Personnaliser le contenu en fonction du profil du destinataire
•Reformuler les messages pour eviter les repetitions
•Varier les formulations et les accroches d'un email a l'autre
•Produire un contenu qui sonne naturel et humain, jamais robotique
5.4  Suivi CRM
Pour chaque prospect, le systeme offre une vue complete de la relation commerciale :
•Historique complet des emails envoyes et des relances
•Reponses recues et leur classification
•Statut actuel dans le pipeline commercial
•Niveau d'interet detecte par l'IA
•Prochaines actions recommandees par le systeme

CAHIER DES CHARGES — AGENT IA PROSPECTION COMMERCIALEConfidentiel
Agent IA Prospection — Cacao & DerivesPage 12Avril 2026
## 6EXIGENCES NON FONCTIONNELLES
Au-dela  des  fonctionnalites,  le  systeme  doit  repondre  a  un  ensemble  d'exigences  techniques  et
qualitatives garantissant une experience utilisateur optimale et une exploitation fiable en production.
ExigenceDetail
SimpliciteInterface intuitive, prise en main rapide sans formation lourde
SecuriteProtection des donnees, authentification, chiffrement
PerformanceTemps de reponse rapide, envoi progressif sans ralentissement
EvolutiviteArchitecture modulaire permettant l'ajout de fonctionnalites
AccessibiliteApplication web responsive, compatible desktop et mobile
Protection donneesConformite avec les bonnes pratiques de protection des donnees clients
JournalisationTraçabilite complete des actions utilisateurs et systeme
Anti-spamMecanismes de limitation pour eviter le signalement en spam
SauvegardeSauvegardes regulieres et automatiques de la base de donnees

CAHIER DES CHARGES — AGENT IA PROSPECTION COMMERCIALEConfidentiel
Agent IA Prospection — Cacao & DerivesPage 13Avril 2026
## 7CONTRAINTES ET REGLES METIER
Le  systeme  doit  operer  dans  le  respect  strict  d'un  ensemble  de  contraintes  visant  a  garantir  la
qualite de la prospection, la reputation de l'entreprise et la conformite avec les bonnes pratiques du
secteur.
n Envoi progressif
Les  emails  doivent  etre  envoyes  de  maniere  graduelle  pour  ne  pas  declencher  les  filtres
anti-spam des fournisseurs de messagerie.
n Delivrabilite
Le systeme doit respecter scrupuleusement les bonnes pratiques de delivrabilite : SPF, DKIM,
DMARC, reputation du domaine.
n Contenu unique
Chaque  email  doit  etre  suffisamment  personnalise  pour  ne  pas  etre  considere  comme  du
contenu duplique par les filtres.
n Gestion doublons
Les  doublons  de  contacts  doivent  etre  detectes  et  elimines  automatiquement  pour  eviter  les
envois multiples au meme destinataire.
n Validation humaine
Une etape de validation par un operateur humain peut etre imposee avant tout envoi definitif
pour garantir la qualite.
n Filtrage qualite
Les adresses email invalides, les prospects non qualifies et les contacts obsoletes doivent etre
filtres avant l'envoi.

CAHIER DES CHARGES — AGENT IA PROSPECTION COMMERCIALEConfidentiel
Agent IA Prospection — Cacao & DerivesPage 14Avril 2026
## 8LIVRABLES ATTENDUS
Le  projet  donnera  lieu  a  la  livraison  des  elements  suivants,  chacun  constituant  un  composant
essentiel de la solution finale :
#LivrableDescription
1Interface prospectsModule complet de gestion de la base de contacts
2Module segmentationOutil de segmentation et ciblage des prospects
3Module IAMoteur de redaction automatique des emails commerciaux
4Module envoiSysteme d'envoi d'emails avec gestion des quotas
5Module relanceSysteme de relances automatiques intelligentes
6Module reponsesAnalyse et classification des reponses entrantes
7Tableau de bordDashboard avec KPI et visualisations
8DocumentationDocumentation technique complete de la solution
9Guide utilisateurManuel d'utilisation pour les equipes commerciales

CAHIER DES CHARGES — AGENT IA PROSPECTION COMMERCIALEConfidentiel
Agent IA Prospection — Cacao & DerivesPage 15Avril 2026
## 9ARCHITECTURE TECHNIQUE
L'architecture retenue est de type modulaire, separant clairement les couches de presentation, de
logique  metier,  de  donnees  et  de  services  externes.  Cette  approche  garantit  l'evolutivite,  la
maintenabilite et la possibilite de faire evoluer chaque composant independamment.
Pile technologique recommandee :
CoucheTechnologieRole
FrontendNext.js (React)Interface utilisateur web responsive
BackendNode.js / NestJSAPI metier, orchestration des services
Base de donneesPostgreSQLStockage des prospects, campagnes, historique
Intelligence artificielleAPI OpenAIGeneration de contenu, classification
Service emailSendGrid / BrevoEnvoi, delivrabilite, tracking
AutomatisationBullMQ / CronPlanification, relances, taches asynchrones
DashboardIntegre (Next.js)Visualisation des KPI et rapports
Diagramme d'architecture logique :

CAHIER DES CHARGES — AGENT IA PROSPECTION COMMERCIALEConfidentiel
Agent IA Prospection — Cacao & DerivesPage 16Avril 2026
Architecture Logique du Systeme
## Utilisateur
## Web / Mobile
## Frontend Next.js
## Interface Web
API Backend
Node.js / NestJS
PostgreSQL
Base de donnees
API OpenAI
Moteur IA
Historique / CRM
Donnees prospects
## Service Email
SendGrid / Brevo
## Prospects / Clients
## Destinataires
## Scheduler
BullMQ / Cron

CAHIER DES CHARGES — AGENT IA PROSPECTION COMMERCIALEConfidentiel
Agent IA Prospection — Cacao & DerivesPage 17Avril 2026
## 10MODULES TECHNIQUES
Le   systeme   est   decoupe   en   sept   modules   techniques,   chacun   responsable   d'un   domaine
fonctionnel  precis.  Cette  modularite  facilite  le  developpement,  les  tests  et  la  maintenance  de  la
solution.
Vue d'ensemble des Modules
## M1
## Prospects
## Import, Nettoyage
## Doublons, Validation
## M2
## Segmentation
## Filtres, Scoring
Ciblage produit
## M3
Moteur IA
## Redaction, Relance
## Traduction
## M4
## Envoi Email
## Lots, Quotas
## Tracking
## M5
## Relances
## Auto, Variation
Arret conditionnel
## M6
Mini CRM
## Fiches, Pipeline
## Historique
## M7
## Analytics
KPI, Rapports
## Performance
Module 1 — Gestion des prospects
•Import de fichiers CSV et Excel avec mapping des colonnes
•Nettoyage et normalisation des donnees (accents, casse, espaces)
•Detection et fusion des doublons par algorithme de similarite
•Validation des adresses email (format, existence du domaine)
•Enrichissement basique des fiches (pays a partir du domaine, etc.)
## Module 2 — Segmentation
•Definition de regles de segmentation multicriteres
•Filtres dynamiques combinables (ET / OU)
•Scoring commercial automatique base sur le profil
•Ciblage par produit, zone geographique et priorite
Module 3 — Moteur IA
•Redaction automatique du mail initial personnalise
•Redaction de relances variees avec changement d'angle
•Reformulation intelligente pour eviter les repetitions

CAHIER DES CHARGES — AGENT IA PROSPECTION COMMERCIALEConfidentiel
Agent IA Prospection — Cacao & DerivesPage 18Avril 2026
•Traduction automatique dans la langue du destinataire
•Classification des reponses entrantes par categorie
Module 4 — Moteur d'envoi
•Preparation du lot d'envoi avec controle qualite
•Envoi progressif avec espacement temporel entre les messages
•Gestion des quotas journaliers et horaires
•Suivi des statuts (envoye, delivre, ouvert, clique, rebond)
•Integration du tracking (pixels, liens traces)
Module 5 — Relance intelligente
•Declenchement automatique selon le calendrier defini
•Variation du contenu et de l'angle commercial a chaque relance
•Arret conditionnel des qu'une reponse est detectee
•Proposition d'action suivante en fonction du comportement
Module 6 — Mini CRM
•Fiche prospect detaillee avec toutes les informations utiles
•Historique complet des interactions (emails, reponses, notes)
•Gestion du pipeline commercial (statuts, etapes)
•Prise de notes commerciales par les utilisateurs
## Module 7 — Analytics
•Indicateurs globaux de performance en temps reel
•Rapports detailles par campagne
•Analyse de performance par produit et par segment
•Analyse geographique des resultats