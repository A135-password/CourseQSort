from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser
from django.db.models import Q

from apps.accounts.permissions import IsAdminUser
from apps.common.pagination import PageNumberPagination
from apps.courses.models import Major, Teacher, Classroom, Course, Student
from apps.courses.serializers import (
    MajorSerializer, TeacherSerializer, ClassroomSerializer,
    CourseListSerializer, CourseDetailSerializer,
    CourseCreateSerializer, StudentSerializer,
)
from apps.courses.import_export import import_courses_from_excel


class CourseViewSet(viewsets.ModelViewSet):
    queryset = Course.objects.all().order_by('-semester', 'name')
    permission_classes = [IsAuthenticated, IsAdminUser]
    pagination_class = PageNumberPagination

    def get_serializer_class(self):
        if self.action in ('create', 'partial_update', 'update'):
            return CourseCreateSerializer
        if self.action == 'list':
            return CourseListSerializer
        return CourseDetailSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        semester = self.request.query_params.get('semester')
        major = self.request.query_params.get('major')
        keyword = self.request.query_params.get('keyword')
        is_professional = self.request.query_params.get('is_professional')

        if semester:
            qs = qs.filter(semester=semester)
        if major:
            qs = qs.filter(major_id=major)
        if keyword:
            qs = qs.filter(
                Q(name__icontains=keyword) | Q(code__icontains=keyword)
            )
        if is_professional is not None:
            val = is_professional.lower() in ('true', '1')
            qs = qs.filter(is_professional_course=val)

        return qs.select_related('major').prefetch_related('teachers')


class TeacherViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Teacher.objects.all().order_by('name')
    serializer_class = TeacherSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    pagination_class = PageNumberPagination

    def get_queryset(self):
        qs = super().get_queryset()
        keyword = self.request.query_params.get('keyword')
        if keyword:
            qs = qs.filter(
                Q(name__icontains=keyword) | Q(employee_no__icontains=keyword)
            )
        return qs


class ClassroomViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Classroom.objects.all().order_by('building', 'name')
    serializer_class = ClassroomSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    pagination_class = PageNumberPagination


class MajorViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = Major.objects.all().order_by('name')
    serializer_class = MajorSerializer
    permission_classes = [IsAuthenticated, IsAdminUser]
    pagination_class = PageNumberPagination

    @action(detail=True, methods=['get'])
    def students(self, request, pk=None):
        major = self.get_object()
        students = Student.objects.filter(major=major).order_by('student_no')
        page = self.paginate_queryset(students)
        if page is not None:
            serializer = StudentSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)
        serializer = StudentSerializer(students, many=True)
        return Response(serializer.data)


class CourseImportView(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, IsAdminUser]
    parser_classes = [MultiPartParser]

    def create(self, request):
        file = request.FILES.get('file')
        if not file:
            return Response(
                {'detail': 'No file provided'},
                status=status.HTTP_400_BAD_REQUEST
            )
        try:
            result = import_courses_from_excel(file)
            return Response(result, status=status.HTTP_201_CREATED)
        except Exception as e:
            return Response(
                {'detail': str(e)},
                status=status.HTTP_400_BAD_REQUEST
            )
