import 'dart:async';
import 'dart:io';
import 'package:flutter/material.dart';
import 'package:audioplayers/audioplayers.dart';
import 'package:file_picker/file_picker.dart';
import 'api_service.dart';
import 'models.dart';
import 'constants.dart';

void main() {
  runApp(const MemoryForgeApp());
}

class MemoryForgeApp extends StatelessWidget {
  const MemoryForgeApp({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'MemoryForge',
      theme: ThemeData(
        brightness: Brightness.dark,
        primarySwatch: Colors.green,
        scaffoldBackgroundColor: const Color(0xFF0F172A),
        appBarTheme: const AppBarTheme(backgroundColor: Color(0xFF1E293B)),
      ),
      home: const MainScreen(),
    );
  }
}

class MainScreen extends StatefulWidget {
  const MainScreen({Key? key}) : super(key: key);

  @override
  _MainScreenState createState() => _MainScreenState();
}

class _MainScreenState extends State<MainScreen> {
  int _currentIndex = 0;
  List<Topic> _flashcards = [];
  Timer? _pollingTimer;

  @override
  void initState() {
    super.initState();
    _fetchData();
    // Start background polling for local isolated network
    _pollingTimer = Timer.periodic(const Duration(seconds: 5), (timer) {
      _pollNotifications();
    });
  }

  @override
  void dispose() {
    _pollingTimer?.cancel();
    super.dispose();
  }

  Future<void> _fetchData() async {
    try {
      final cards = await ApiService.getFlashcards();
      setState(() {
        _flashcards = cards;
      });
    } catch (e) {
      debugPrint("Failed to fetch flashcards: $e");
    }
  }

  Future<void> _pollNotifications() async {
    try {
      final notifications = await ApiService.getPendingNotifications();
      if (notifications.isNotEmpty) {
        for (var n in notifications) {
          _showBanner(n);
        }
      }
    } catch (e) {}
  }

  void _showBanner(NotificationDetail notification) {
    // Clear notification locally
    ApiService.clearNotification(notification.notificationId);

    // Calculate Banner Color
    Color bannerColor = Colors.blueGrey.shade800;
    if (notification.urgencyLevel == "critical") bannerColor = Colors.red.shade900;
    if (notification.urgencyLevel == "danger") bannerColor = Colors.orange.shade900;

    ScaffoldMessenger.of(context).showMaterialBanner(
      MaterialBanner(
        content: Text(
          "Review Time: ${notification.topicName} (Retention: ${notification.retentionScore}%)",
          style: const TextStyle(color: Colors.white, fontWeight: FontWeight.bold),
        ),
        leading: const Icon(Icons.warning_rounded, color: Colors.white),
        backgroundColor: bannerColor,
        actions: [
          TextButton(
            onPressed: () {
              ScaffoldMessenger.of(context).hideCurrentMaterialBanner();
              // Navigate based on action
              if (notification.action == 'force_quiz' || notification.action == 'open_quiz') {
                Navigator.push(context, MaterialPageRoute(builder: (_) => QuizScreen(flashcardId: notification.flashcardId, question: notification.question)));
              } else {
                Navigator.push(context, MaterialPageRoute(builder: (_) => SummaryScreen(notification: notification)));
              }
            },
            child: const Text('REVIEW NOW', style: TextStyle(color: Colors.white)),
          ),
          TextButton(
            onPressed: () => ScaffoldMessenger.of(context).hideCurrentMaterialBanner(),
            child: const Text('DISMISS', style: TextStyle(color: Colors.white54)),
          ),
        ],
      ),
    );
  }

  void _showAddDialog() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF1E293B),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(20))),
      builder: (context) {
        return const AddBottomSheet();
      },
    ).then((_) => _fetchData());
  }

  @override
  Widget build(BuildContext context) {
    final screens = [
      HomeScreen(flashcards: _flashcards, onRefresh: _fetchData),
      SettingsScreen()
    ];

    return Scaffold(
      body: screens[_currentIndex],
      floatingActionButton: FloatingActionButton(
        onPressed: _showAddDialog,
        backgroundColor: Colors.greenAccent.shade400,
        child: const Icon(Icons.add, color: Colors.black),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _currentIndex,
        onTap: (i) => setState(() => _currentIndex = i),
        backgroundColor: const Color(0xFF1E293B),
        selectedItemColor: Colors.greenAccent,
        unselectedItemColor: Colors.grey,
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.home), label: 'Home'),
          BottomNavigationBarItem(icon: Icon(Icons.settings), label: 'Settings'),
        ],
      ),
    );
  }
}

// ----------------------------------------------------
// HOME SCREEN
// ----------------------------------------------------
class HomeScreen extends StatelessWidget {
  final List<Topic> flashcards;
  final VoidCallback onRefresh;

  const HomeScreen({Key? key, required this.flashcards, required this.onRefresh}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: () async => onRefresh(),
      child: CustomScrollView(
        slivers: [
          const SliverAppBar(
            title: Text("MemoryForge", style: TextStyle(fontWeight: FontWeight.bold)),
            floating: true,
          ),
          if (flashcards.isEmpty)
            const SliverFillRemaining(
              child: Center(child: Text("No memories tracked.\nTap + to ingest data.", textAlign: TextAlign.center, style: TextStyle(color: Colors.grey))),
            )
          else
            SliverList(
              delegate: SliverChildBuilderDelegate(
                (context, index) {
                  final fc = flashcards[index];
                  Color scoreColor = Colors.greenAccent;
                  if (fc.retentionScore < 50) scoreColor = Colors.orange;
                  if (fc.retentionScore < 30) scoreColor = Colors.redAccent;

                  return Card(
                    color: const Color(0xFF1E293B),
                    margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                    child: ListTile(
                      title: Text(fc.topicName, style: const TextStyle(fontWeight: FontWeight.bold)),
                      subtitle: Text("Next Ping: ${fc.nextReminderMinutes}m", style: const TextStyle(color: Colors.grey)),
                      trailing: Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(color: scoreColor.withOpacity(0.2), borderRadius: BorderRadius.circular(8)),
                        child: Text("${fc.retentionScore}%", style: TextStyle(color: scoreColor, fontWeight: FontWeight.bold)),
                      ),
                    ),
                  );
                },
                childCount: flashcards.length,
              ),
            ),
        ],
      ),
    );
  }
}

// ----------------------------------------------------
// ADD BOTTOM SHEET (Multi Modal Ingestion)
// ----------------------------------------------------
class AddBottomSheet extends StatefulWidget {
  const AddBottomSheet({Key? key}) : super(key: key);

  @override
  _AddBottomSheetState createState() => _AddBottomSheetState();
}

class _AddBottomSheetState extends State<AddBottomSheet> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final TextEditingController _topicCtrl = TextEditingController();
  final TextEditingController _textCtrl = TextEditingController();
  final TextEditingController _ytCtrl = TextEditingController();
  
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  void _submitText() async {
    setState(() => _isLoading = true);
    await ApiService.ingestText(_topicCtrl.text, _textCtrl.text);
    Navigator.pop(context);
  }

  void _submitYoutube() async {
    setState(() => _isLoading = true);
    await ApiService.ingestYoutube(_topicCtrl.text, _ytCtrl.text);
    Navigator.pop(context);
  }

  void _pickAndUploadFile() async {
    FilePickerResult? result = await FilePicker.platform.pickFiles(type: FileType.custom, allowedExtensions: ['pdf', 'txt']);
    if (result != null && result.files.single.path != null) {
      setState(() => _isLoading = true);
      File file = File(result.files.single.path!);
      await ApiService.ingestFile(_topicCtrl.text, file);
      Navigator.pop(context);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom, left: 16, right: 16, top: 16),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          TabBar(
            controller: _tabController,
            indicatorColor: Colors.greenAccent,
            tabs: const [
              Tab(text: "Notes"),
              Tab(text: "Video"),
              Tab(text: "File"),
            ],
          ),
          const SizedBox(height: 16),
          TextField(controller: _topicCtrl, decoration: const InputDecoration(labelText: "Topic Name (e.g. History)")),
          const SizedBox(height: 16),
          SizedBox(
            height: 200,
            child: _isLoading 
                ? const Center(child: CircularProgressIndicator()) 
                : TabBarView(
              controller: _tabController,
              children: [
                // Notes Tab
                Column(
                  children: [
                    Expanded(child: TextField(controller: _textCtrl, maxLines: 5, decoration: const InputDecoration(hintText: "Paste your raw notes here..."))),
                    ElevatedButton(onPressed: _submitText, child: const Text("Ingest via AI"))
                  ],
                ),
                // Video Tab
                Column(
                  children: [
                    TextField(controller: _ytCtrl, decoration: const InputDecoration(labelText: "YouTube URL")),
                    const SizedBox(height: 16),
                    ElevatedButton(onPressed: _submitYoutube, child: const Text("Ingest Video Transcript"))
                  ],
                ),
                // File Tab
                Center(
                  child: ElevatedButton.icon(
                    onPressed: _pickAndUploadFile, 
                    icon: const Icon(Icons.upload_file),
                    label: const Text("Pick PDF or TXT")
                  ),
                )
              ],
            ),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }
}

// ----------------------------------------------------
// SUMMARY SCREEN (Audio playback)
// ----------------------------------------------------
class SummaryScreen extends StatefulWidget {
  final NotificationDetail notification;
  const SummaryScreen({Key? key, required this.notification}) : super(key: key);

  @override
  _SummaryScreenState createState() => _SummaryScreenState();
}

class _SummaryScreenState extends State<SummaryScreen> {
  final AudioPlayer _player = AudioPlayer();

  @override
  void initState() {
    super.initState();
    // Auto play audio payload from backend
    _player.play(UrlSource(widget.notification.audioUrl));
  }

  @override
  void dispose() {
    _player.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text("Audio Summary")),
      body: Center(
        child: Padding(
          padding: const EdgeInsets.all(24.0),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.headphones_rounded, size: 80, color: Colors.greenAccent),
              const SizedBox(height: 24),
              Text(widget.notification.topicName, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
              const SizedBox(height: 16),
              Text(widget.notification.summaryText, textAlign: TextAlign.center, style: const TextStyle(fontSize: 18, color: Colors.grey)),
              const SizedBox(height: 40),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                children: [
                  ElevatedButton(onPressed: () {
                    ApiService.reviewFlashcard(widget.notification.flashcardId, 'remembered');
                    Navigator.pop(context);
                  }, style: ElevatedButton.styleFrom(backgroundColor: Colors.green), child: const Text("Got It")),
                  ElevatedButton(onPressed: () {
                    ApiService.reviewFlashcard(widget.notification.flashcardId, 'hard');
                    Navigator.pop(context);
                  }, style: ElevatedButton.styleFrom(backgroundColor: Colors.orange), child: const Text("Hard")),
                  ElevatedButton(onPressed: () {
                    ApiService.reviewFlashcard(widget.notification.flashcardId, 'forgot');
                    Navigator.pop(context);
                  }, style: ElevatedButton.styleFrom(backgroundColor: Colors.red), child: const Text("Forgot")),
                ],
              )
            ],
          ),
        ),
      ),
    );
  }
}

// ----------------------------------------------------
// QUIZ SCREEN
// ----------------------------------------------------
class QuizScreen extends StatelessWidget {
  final String flashcardId;
  final String question;

  const QuizScreen({Key? key, required this.flashcardId, required this.question}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Recall Quiz")),
      body: Container(
        color: Colors.red.shade900.withOpacity(0.2),
        width: double.infinity,
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.warning_amber_rounded, color: Colors.redAccent, size: 64),
            const SizedBox(height: 24),
            const Text("CRITICAL DECAY", style: TextStyle(color: Colors.redAccent, fontWeight: FontWeight.bold, letterSpacing: 2)),
            const SizedBox(height: 16),
            Text(question, textAlign: TextAlign.center, style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold)),
            const Spacer(),
            ElevatedButton(
              onPressed: () {
                ApiService.reviewFlashcard(flashcardId, 'remembered');
                Navigator.pop(context);
              },
              style: ElevatedButton.styleFrom(backgroundColor: Colors.green, minimumSize: const Size(double.infinity, 50)),
              child: const Text("I Remembered"),
            ),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: () {
                ApiService.reviewFlashcard(flashcardId, 'forgot');
                Navigator.pop(context);
              },
              style: ElevatedButton.styleFrom(backgroundColor: Colors.red, minimumSize: const Size(double.infinity, 50)),
              child: const Text("I Forgot"),
            ),
            const SizedBox(height: 40)
          ],
        ),
      ),
    );
  }
}

// ----------------------------------------------------
// SETTINGS SCREEN
// ----------------------------------------------------
class SettingsScreen extends StatefulWidget {
  const SettingsScreen({Key? key}) : super(key: key);

  @override
  _SettingsScreenState createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  bool _demoMode = false;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("System Output Settings")),
      body: ListView(
        children: [
          SwitchListTile(
            title: const Text("Demo Time Compression"),
            subtitle: const Text("Simulates 24 hours of memory decay in 1 minute. Used for hackathon demo."),
            value: _demoMode,
            onChanged: (val) {
              setState(() => _demoMode = val);
              ApiService.setDemoMode(val);
            },
          ),
          ListTile(
            title: const Text("Clear notification queue"),
            onTap: () {
              ApiService.clearAllNotifications();
              ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text("Cleared queues")));
            },
            trailing: const Icon(Icons.delete),
          ),
        ],
      ),
    );
  }
}
