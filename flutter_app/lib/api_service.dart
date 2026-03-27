import 'dart:convert';
import 'package:http/http.dart' as http;
import 'constants.dart';
import 'models.dart';
import 'dart:io';

class ApiService {
  static Future<List<Topic>> getFlashcards() async {
    final response = await http.get(Uri.parse('${AppConstants.backendUrl}/flashcards'));
    if (response.statusCode == 200) {
      final List data = json.decode(response.body);
      return data.map((json) => Topic.fromJson(json)).toList();
    }
    return [];
  }

  static Future<List<NotificationDetail>> getPendingNotifications() async {
    final response = await http.get(Uri.parse('${AppConstants.backendUrl}/notifications/pending'));
    if (response.statusCode == 200) {
      final List data = json.decode(response.body);
      return data.map((json) => NotificationDetail.fromJson(json)).toList();
    }
    return [];
  }

  static Future<void> clearNotification(String id) async {
    await http.post(
      Uri.parse('${AppConstants.backendUrl}/notifications/clear'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({'notification_id': id}),
    );
  }

  static Future<void> clearAllNotifications() async {
    await http.post(Uri.parse('${AppConstants.backendUrl}/notifications/clear-all'));
  }

  static Future<void> reviewFlashcard(String flashcardId, String result) async {
    await http.post(
      Uri.parse('${AppConstants.backendUrl}/flashcard/review'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({
        'flashcard_id': flashcardId,
        'result': result,
      }),
    );
  }

  static Future<Topic> ingestText(String topicName, String text) async {
    await http.post(
      Uri.parse('${AppConstants.backendUrl}/ingest/text'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({'topic_name': topicName, 'text': text}),
    );
    // Returns first element logic simplified
    final cards = await getFlashcards();
    return cards.last;
  }

  static Future<Topic> ingestYoutube(String topicName, String url) async {
    await http.post(
      Uri.parse('${AppConstants.backendUrl}/ingest/youtube'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({'topic_name': topicName, 'url': url}),
    );
    final cards = await getFlashcards();
    return cards.last;
  }

  static Future<void> ingestFile(String topicName, File file) async {
    var request = http.MultipartRequest('POST', Uri.parse('${AppConstants.backendUrl}/ingest/file'));
    request.fields['topic_name'] = topicName;
    request.files.add(await http.MultipartFile.fromPath('file', file.path));
    await request.send();
  }

  static Future<void> setDemoMode(bool enabled) async {
    await http.post(
      Uri.parse('${AppConstants.backendUrl}/settings/demo-mode'),
      headers: {'Content-Type': 'application/json'},
      body: json.encode({'enabled': enabled}),
    );
  }
}
